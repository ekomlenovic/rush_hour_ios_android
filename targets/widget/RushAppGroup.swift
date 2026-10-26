import Foundation

/// The app group the app and its home screen widget share (issue 151).
/// The same file is in modules/rush-widget/ios and targets/widget (checked by __tests__/widget.test.ts).
///
/// SideStore registers the group under the player's team ("group.com.rushhours.app.<TEAMID>") and
/// signs the app and the widget with that one: the group is the one this process is really entitled
/// to, read where SideStore puts it (code signature, embedded profile, ALTAppGroups of older versions).
enum RushAppGroup {
  static let base = "group.com.rushhours.app"

  /// The group this process can use, nil without one (an install that has no app group)
  static let identifier: String? = {
    let candidates = signedGroups() + profileGroups() + infoPlistGroups() + [base]
    return candidates.first { group in
      group.hasPrefix(base) && FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group) != nil
    }
  }()

  /// Settings shared with the widget, nil without the app group (they would stay in this process)
  static var defaults: UserDefaults? {
    identifier.flatMap { UserDefaults(suiteName: $0) }
  }

  private static func groups(in entitlements: [String: Any]?) -> [String] {
    entitlements?["com.apple.security.application-groups"] as? [String] ?? []
  }

  private static func plist(_ data: Data) -> [String: Any]? {
    (try? PropertyListSerialization.propertyList(from: data, options: [], format: nil)) as? [String: Any]
  }

  /// Entitlements of the executable's code signature, as SideStore reads them
  private static func signedGroups() -> [String] {
    guard let url = Bundle.main.executableURL,
          let binary = try? Data(contentsOf: url, options: .alwaysMapped),
          let xml = entitlementsXML(in: binary)
    else { return [] }
    return groups(in: plist(xml))
  }

  /// Entitlements of the provisioning profile the app was signed with
  private static func profileGroups() -> [String] {
    guard let url = Bundle.main.url(forResource: "embedded", withExtension: "mobileprovision"),
          let profile = try? Data(contentsOf: url),
          let start = profile.range(of: Data("<?xml".utf8)),
          let end = profile.range(of: Data("</plist>".utf8), options: [], in: start.lowerBound..<profile.endIndex)
    else { return [] }
    return groups(in: plist(profile.subdata(in: start.lowerBound..<end.upperBound))?["Entitlements"] as? [String: Any])
  }

  /// AltStore and older SideStore versions wrote the groups in the Info.plist
  private static func infoPlistGroups() -> [String] {
    Bundle.main.object(forInfoDictionaryKey: "ALTAppGroups") as? [String] ?? []
  }

  /// A big- or little-endian 32-bit word of the binary, nil past its end
  private static func word(_ binary: Data, _ offset: Int, bigEndian: Bool) -> Int? {
    guard offset >= 0, offset + 4 <= binary.count else { return nil }
    let raw = binary.withUnsafeBytes { $0.loadUnaligned(fromByteOffset: offset, as: UInt32.self) }
    return Int(bigEndian ? UInt32(bigEndian: raw) : UInt32(littleEndian: raw))
  }

  /// The XML entitlements blob of a Mach-O code signature; in a universal binary, of the first slice that has one
  private static func entitlementsXML(in binary: Data) -> Data? {
    guard word(binary, 0, bigEndian: true) == 0xcafe_babe else { return sliceEntitlementsXML(in: binary, at: 0) }
    // fat_header (magic, nfat_arch), then fat_arch entries of 20 bytes: cputype, cpusubtype, offset, size, align
    guard let slices = word(binary, 4, bigEndian: true) else { return nil }
    for index in 0..<min(slices, 8) {
      if let offset = word(binary, 8 + index * 20 + 8, bigEndian: true),
         let xml = sliceEntitlementsXML(in: binary, at: offset) {
        return xml
      }
    }
    return nil
  }

  private static func sliceEntitlementsXML(in binary: Data, at slice: Int) -> Data? {
    // mach_header_64: ncmds at 16, load commands after its 32 bytes
    guard word(binary, slice, bigEndian: false) == 0xfeed_facf,
          let commands = word(binary, slice + 16, bigEndian: false)
    else { return nil }
    var command = slice + 32
    for _ in 0..<min(commands, 4096) {
      guard let kind = word(binary, command, bigEndian: false),
            let size = word(binary, command + 4, bigEndian: false), size > 0
      else { return nil }
      // LC_CODE_SIGNATURE: a SuperBlob (big-endian) with its blob indexes
      if kind == 0x1d {
        guard let dataOffset = word(binary, command + 8, bigEndian: false) else { return nil }
        let superBlob = slice + dataOffset
        guard word(binary, superBlob, bigEndian: true) == 0xfade_0cc0,
              let count = word(binary, superBlob + 8, bigEndian: true)
        else { return nil }
        for index in 0..<min(count, 64) {
          let entry = superBlob + 12 + index * 8
          guard let type = word(binary, entry, bigEndian: true),
                let offset = word(binary, entry + 4, bigEndian: true)
          else { return nil }
          let blob = superBlob + offset
          // CSSLOT_ENTITLEMENTS, CSMAGIC_EMBEDDED_ENTITLEMENTS
          if type == 5, word(binary, blob, bigEndian: true) == 0xfade_7171,
             let length = word(binary, blob + 4, bigEndian: true), length > 8, blob + length <= binary.count {
            return binary.subdata(in: (blob + 8)..<(blob + length))
          }
        }
        return nil
      }
      command += size
    }
    return nil
  }
}
