import { execFileSync } from "node:child_process"
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const buildDir = process.env.ELECTROBUN_BUILD_DIR
const appName = process.env.ELECTROBUN_APP_NAME

if (!buildDir) throw new Error("ELECTROBUN_BUILD_DIR is required")
if (!appName) throw new Error("ELECTROBUN_APP_NAME is required")

const plistPath = join(buildDir, `${appName}.app`, "Contents", "Info.plist")
const appBundlePath = join(buildDir, `${appName}.app`)
const normalizedAppBundlePath = join(buildDir, `${appName}.normalized.app`)
if (!existsSync(plistPath)) throw new Error(`Info.plist not found: ${plistPath}`)

const documentTypes = `    <key>CFBundleDocumentTypes</key>
    <array>
        <dict>
            <key>CFBundleTypeName</key>
            <string>Markdown Document</string>
            <key>CFBundleTypeRole</key>
            <string>Editor</string>
            <key>CFBundleTypeExtensions</key>
            <array>
                <string>md</string>
                <string>markdown</string>
            </array>
            <key>LSItemContentTypes</key>
            <array>
                <string>net.daringfireball.markdown</string>
                <string>public.markdown</string>
            </array>
            <key>LSHandlerRank</key>
            <string>Alternate</string>
        </dict>
    </array>`

const plist = readFileSync(plistPath, "utf-8")
if (plist.includes("<key>CFBundleDocumentTypes</key>")) {
  throw new Error(`CFBundleDocumentTypes already exists in ${plistPath}`)
}
if (!plist.includes("\n</dict>")) throw new Error(`Unexpected Info.plist format: ${plistPath}`)

writeFileSync(plistPath, plist.replace("\n</dict>", `\n${documentTypes}\n</dict>`))
execFileSync("plutil", ["-lint", plistPath], { stdio: "inherit" })

rmSync(normalizedAppBundlePath, { recursive: true, force: true })
execFileSync("ditto", ["--norsrc", appBundlePath, normalizedAppBundlePath], { stdio: "inherit" })
rmSync(appBundlePath, { recursive: true, force: true })
renameSync(normalizedAppBundlePath, appBundlePath)
