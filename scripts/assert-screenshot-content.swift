#!/usr/bin/env swift

import CoreGraphics
import Darwin
import Foundation
import ImageIO

enum ScreenshotError: Error, CustomStringConvertible {
  case missingPath
  case unreadableImage(String)
  case unableToRender
  case mostlyBlank(offDominantFraction: Double, distinctColors: Int)

  var description: String {
    switch self {
    case .missingPath:
      return "usage: assert-screenshot-content.swift <screenshot.png>"
    case .unreadableImage(let path):
      return "could not read screenshot: \(path)"
    case .unableToRender:
      return "could not render screenshot for analysis"
    case .mostlyBlank(let fraction, let colors):
      let percent = String(format: "%.1f", fraction * 100)
      return "screenshot is nearly blank (\(percent)% non-background pixels, \(colors) colors)"
    }
  }
}

struct ScreenshotAnalysis {
  let offDominantFraction: Double
  let distinctColors: Int

  var hasVisibleAppContent: Bool {
    offDominantFraction >= 0.08 && distinctColors >= 6
  }
}

func analyzeScreenshot(at path: String) throws -> ScreenshotAnalysis {
  let url = URL(fileURLWithPath: path) as CFURL
  guard
    let source = CGImageSourceCreateWithURL(url, nil),
    let image = CGImageSourceCreateImageAtIndex(source, 0, nil)
  else {
    throw ScreenshotError.unreadableImage(path)
  }

  // A small deterministic raster is enough for a blank-screen check. Ignore
  // the outer edge and status-bar band so system chrome cannot make a solid
  // app canvas look healthy.
  let width = 64
  let height = 64
  let bytesPerPixel = 4
  var pixels = [UInt8](repeating: 0, count: width * height * bytesPerPixel)
  let rendered = pixels.withUnsafeMutableBytes { bytes -> Bool in
    guard let context = CGContext(
      data: bytes.baseAddress,
      width: width,
      height: height,
      bitsPerComponent: 8,
      bytesPerRow: width * bytesPerPixel,
      space: CGColorSpaceCreateDeviceRGB(),
      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    ) else {
      return false
    }

    context.interpolationQuality = .low
    context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
    return true
  }
  guard rendered else { throw ScreenshotError.unableToRender }

  var histogram: [UInt16: Int] = [:]
  var sampleCount = 0
  for y in 6..<60 {
    for x in 4..<60 {
      let offset = (y * width + x) * bytesPerPixel
      let red = UInt16(pixels[offset] >> 4)
      let green = UInt16(pixels[offset + 1] >> 4)
      let blue = UInt16(pixels[offset + 2] >> 4)
      let color = (red << 8) | (green << 4) | blue
      histogram[color, default: 0] += 1
      sampleCount += 1
    }
  }

  let dominantCount = histogram.values.max() ?? sampleCount
  return ScreenshotAnalysis(
    offDominantFraction: 1 - Double(dominantCount) / Double(sampleCount),
    distinctColors: histogram.count
  )
}

do {
  guard let path = CommandLine.arguments.dropFirst().first else {
    throw ScreenshotError.missingPath
  }
  let result = try analyzeScreenshot(at: path)
  guard result.hasVisibleAppContent else {
    throw ScreenshotError.mostlyBlank(
      offDominantFraction: result.offDominantFraction,
      distinctColors: result.distinctColors
    )
  }
  let percent = String(format: "%.1f", result.offDominantFraction * 100)
  print("visible content: \(percent)% non-background pixels, \(result.distinctColors) colors")
} catch {
  FileHandle.standardError.write(Data("error: \(error)\n".utf8))
  exit(1)
}
