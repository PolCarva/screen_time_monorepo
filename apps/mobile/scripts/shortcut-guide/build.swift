// Builds the real-screenshot assets for Still's Shortcuts setup guide.
//
//   swift scripts/shortcut-guide/build.swift <raw-captures-dir>
//
// It reads spec.json next to this file, crops each raw simulator capture to
// the bands that matter, stacks them, and writes JPEGs to
// assets/shortcut-guide plus src/components/shortcut-guide-assets.ts with the
// tap targets as fractions of each image, so the app can draw the highlight.
// Raw captures are not committed: retake them with
// `xcrun simctl io <udid> screenshot <file>` and adjust spec.json when iOS
// moves a button.

import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

struct Spec: Decodable {
  struct Screen: Decodable { let width: Double; let height: Double; let scale: Double }
  struct Image: Decodable {
    let id: String
    let source: String
    let bands: [[Double]]
    let highlights: [[Double]]
  }
  let screen: Screen
  let outputWidth: Int
  let images: [Image]
}

func fail(_ message: String) -> Never {
  FileHandle.standardError.write(Data((message + "\n").utf8))
  exit(1)
}

let arguments = CommandLine.arguments
guard arguments.count == 2 else { fail("usage: build.swift <raw-captures-dir>") }
let rawDirectory = URL(fileURLWithPath: arguments[1], isDirectory: true)
let scriptDirectory = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
let mobileRoot = scriptDirectory.deletingLastPathComponent().deletingLastPathComponent()
let outputDirectory = mobileRoot.appendingPathComponent("assets/shortcut-guide", isDirectory: true)
let manifestURL = mobileRoot.appendingPathComponent("src/components/shortcut-guide-assets.ts")

guard let specData = try? Data(contentsOf: scriptDirectory.appendingPathComponent("spec.json")),
  let spec = try? JSONDecoder().decode(Spec.self, from: specData)
else { fail("could not read spec.json") }

try? FileManager.default.createDirectory(at: outputDirectory, withIntermediateDirectories: true)

let gapPoints = 14.0
let outputScale = Double(spec.outputWidth) / spec.screen.width
let colorSpace = CGColorSpaceCreateDeviceRGB()
var manifest: [String] = []

func rounded(_ value: Double) -> String { String(format: "%.4f", value) }

for image in spec.images {
  let sourceURL = rawDirectory.appendingPathComponent(image.source)
  guard let source = CGImageSourceCreateWithURL(sourceURL as CFURL, nil),
    let capture = CGImageSourceCreateImageAtIndex(source, 0, nil)
  else { fail("missing capture \(sourceURL.path)") }

  let gaps = Double(image.bands.count - 1) * gapPoints
  let heightPoints = image.bands.reduce(0) { $0 + ($1[1] - $1[0]) } + gaps
  let width = spec.outputWidth
  let height = Int((heightPoints * outputScale).rounded())

  guard let context = CGContext(
    data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0,
    space: colorSpace, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)
  else { fail("could not create a drawing context") }
  context.interpolationQuality = .high
  // The strip between bands says "the screen continues here".
  context.setFillColor(CGColor(red: 0.80, green: 0.80, blue: 0.83, alpha: 1))
  context.fill(CGRect(x: 0, y: 0, width: width, height: height))

  var bandOffsets: [Double] = []
  var cursor = 0.0
  for (index, band) in image.bands.enumerated() {
    bandOffsets.append(cursor)
    let bandHeight = band[1] - band[0]
    let crop = CGRect(
      x: 0, y: band[0] * spec.screen.scale,
      width: spec.screen.width * spec.screen.scale, height: bandHeight * spec.screen.scale)
    guard let slice = capture.cropping(to: crop) else { fail("bad band in \(image.id)") }
    // Core Graphics has its origin at the bottom left.
    let top = cursor * outputScale
    let drawHeight = bandHeight * outputScale
    context.draw(
      slice,
      in: CGRect(x: 0, y: Double(height) - top - drawHeight, width: Double(width), height: drawHeight))
    cursor += bandHeight
    if index < image.bands.count - 1 {
      let dotY = Double(height) - (cursor + gapPoints / 2) * outputScale
      context.setFillColor(CGColor(red: 0.45, green: 0.45, blue: 0.50, alpha: 1))
      for offset in [-14.0, 0.0, 14.0] {
        context.fillEllipse(
          in: CGRect(x: Double(width) / 2 + offset * outputScale / 2 - 3, y: dotY - 3, width: 6, height: 6))
      }
      cursor += gapPoints
    }
  }

  guard let output = context.makeImage() else { fail("could not render \(image.id)") }
  let outputURL = outputDirectory.appendingPathComponent("\(image.id).jpg")
  guard let destination = CGImageDestinationCreateWithURL(
    outputURL as CFURL, UTType.jpeg.identifier as CFString, 1, nil)
  else { fail("could not write \(outputURL.path)") }
  CGImageDestinationAddImage(
    destination, output, [kCGImageDestinationLossyCompressionQuality: 0.82] as CFDictionary)
  guard CGImageDestinationFinalize(destination) else { fail("could not finish \(outputURL.path)") }

  let highlights = image.highlights.map { entry -> String in
    let band = Int(entry[0])
    let top = bandOffsets[band] + (entry[2] - image.bands[band][0])
    return "      { left: \(rounded(entry[1] / spec.screen.width)), top: \(rounded(top / heightPoints)), "
      + "width: \(rounded(entry[3] / spec.screen.width)), height: \(rounded(entry[4] / heightPoints)) },"
  }
  manifest.append(
    """
      "\(image.id)": {
        source: require("../../assets/shortcut-guide/\(image.id).jpg"),
        aspectRatio: \(rounded(spec.screen.width / heightPoints)),
        highlights: [
    \(highlights.joined(separator: "\n"))
        ],
      },
    """)
  print("wrote \(image.id).jpg \(width)x\(height)")
}

let header = """
  // Generated by scripts/shortcut-guide/build.swift from spec.json. Do not edit by hand.
  // Real captures of Apple's Shortcuts app (iOS 26) and where to tap on each one.

  import type { ImageSourcePropType } from "react-native";

  /** Position and size as fractions of the image, so they scale with it. */
  export type GuideHighlight = {
    left: number;
    top: number;
    width: number;
    height: number;
  };

  export type GuideImage = {
    source: ImageSourcePropType;
    aspectRatio: number;
    /** In the order the user taps them. */
    highlights: GuideHighlight[];
  };

  export const SHORTCUT_GUIDE_IMAGES = {

  """
let footer = "} satisfies Record<string, GuideImage>;\n\nexport type GuideImageId = keyof typeof SHORTCUT_GUIDE_IMAGES;\n"
let body = header.split(separator: "\n", omittingEmptySubsequences: false)
  .map { $0.hasPrefix("  ") ? String($0.dropFirst(2)) : String($0) }
  .joined(separator: "\n")
try (body + manifest.joined(separator: "\n") + "\n" + footer)
  .write(to: manifestURL, atomically: true, encoding: .utf8)
print("wrote \(manifestURL.lastPathComponent)")
