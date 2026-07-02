import { describe, expect, test } from "bun:test"
import { FileAccessPolicy } from "./fileAccess"

describe("FileAccessPolicy", () => {
  test("should allow paths inside a workspace folder", () => {
    const policy = new FileAccessPolicy()
    policy.setWorkspaceFolders(["/Users/me/notes"])
    expect(policy.isAllowed("/Users/me/notes/todo.md")).toBe(true)
    expect(policy.isAllowed("/Users/me/notes/sub/deep.md")).toBe(true)
    expect(policy.isAllowed("/Users/me/notes")).toBe(true)
  })

  test("should deny paths outside every workspace folder", () => {
    const policy = new FileAccessPolicy()
    policy.setWorkspaceFolders(["/Users/me/notes"])
    expect(policy.isAllowed("/Users/me/.ssh/id_rsa")).toBe(false)
    expect(policy.isAllowed("/etc/passwd")).toBe(false)
  })

  test("should not treat a sibling with a shared prefix as inside", () => {
    const policy = new FileAccessPolicy()
    policy.setWorkspaceFolders(["/Users/me/notes"])
    expect(policy.isAllowed("/Users/me/notes-secret/x.md")).toBe(false)
  })

  test("should deny traversal that resolves outside the root", () => {
    const policy = new FileAccessPolicy()
    policy.setWorkspaceFolders(["/Users/me/notes"])
    expect(policy.isAllowed("/Users/me/notes/../.ssh/id_rsa")).toBe(false)
  })

  test("should allow individually allow-listed files anywhere", () => {
    const policy = new FileAccessPolicy()
    policy.allowFile("/Users/me/Desktop/loose.md")
    expect(policy.isAllowed("/Users/me/Desktop/loose.md")).toBe(true)
    expect(policy.isAllowed("/Users/me/Desktop/other.md")).toBe(false)
  })

  test("should permit only known or dialog-approved workspace folders", () => {
    const policy = new FileAccessPolicy()
    policy.setWorkspaceFolders(["/Users/me/notes"])
    policy.approveFolder("/Users/me/docs")
    expect(policy.isFolderPermitted("/Users/me/notes")).toBe(true)
    expect(policy.isFolderPermitted("/Users/me/docs")).toBe(true)
    expect(policy.isFolderPermitted("/")).toBe(false)
    expect(policy.isFolderPermitted("/Users/me")).toBe(false)
  })

  test("should treat approved folders as readable roots", () => {
    const policy = new FileAccessPolicy()
    policy.approveFolder("/Users/me/docs")
    expect(policy.isAllowed("/Users/me/docs/readme.md")).toBe(true)
  })

  test("should throw a descriptive error from assertAllowed", () => {
    const policy = new FileAccessPolicy()
    policy.setWorkspaceFolders(["/Users/me/notes"])
    expect(() => policy.assertAllowed("/etc/passwd")).toThrow(/outside/)
    expect(() => policy.assertAllowed("/Users/me/notes/ok.md")).not.toThrow()
  })

  test("should permit writing an exported .html beside an allowed markdown file", () => {
    const policy = new FileAccessPolicy()
    policy.allowFile("/Users/me/Desktop/notes.md")
    expect(policy.isWritable("/Users/me/Desktop/notes.html")).toBe(true)
    expect(policy.isWritable("/Users/me/Desktop/other.html")).toBe(false)
    expect(policy.isWritable("/Users/me/Desktop/notes.sh")).toBe(false)
    expect(() => policy.assertWritable("/Users/me/Desktop/notes.html")).not.toThrow()
  })

  test("should update roots when workspace folders change", () => {
    const policy = new FileAccessPolicy()
    policy.setWorkspaceFolders(["/a"])
    expect(policy.isAllowed("/a/x.md")).toBe(true)
    policy.setWorkspaceFolders(["/b"])
    expect(policy.isAllowed("/a/x.md")).toBe(false)
    expect(policy.isAllowed("/b/x.md")).toBe(true)
  })
})
