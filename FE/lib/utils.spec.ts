import { describe, it, expect } from "vitest"
import { cn } from "./utils"

describe("cn utility function", () => {
  it("should merge class names correctly", () => {
    const result = cn("px-2 py-1", "bg-blue-500")
    expect(result).toBe("px-2 py-1 bg-blue-500")
  })

  it("should handle conditional class names", () => {
    const isTrue = true
    const isFalse = false
    const result = cn("base-class", isTrue && "active-class", isFalse && "inactive-class")
    expect(result).toBe("base-class active-class")
  })

  it("should resolve tailwind conflicts using tailwind-merge", () => {
    const result = cn("p-4", "p-2")
    expect(result).toBe("p-2")
  })
})
