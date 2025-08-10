"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateKeyPair = generateKeyPair;
exports.rotateKey = rotateKey;
exports.listKids = listKids;
exports.revokeKey = revokeKey;
// src/utils/keyManagement.ts
var crypto_1 = require("crypto");
var fs_1 = require("fs");
var path_1 = require("path");
var dotenv_1 = require("dotenv");
dotenv_1.default.config();
var ENV_PATH = process.env.ENV_FILE || path_1.default.resolve(process.cwd(), ".env");
var CURRENT_KID_ENV = "CURRENT_KID";
var DEFAULT_RSA_BITS = Number(process.env.RSA_MODULUS_BITS || 3072); // 3072 by default
// Always read keys dir from env so --dir can override at runtime
function keysDir() {
    return process.env.JWKS_PATH || path_1.default.resolve(process.cwd(), "src/keys");
}
// Strict kid whitelist to avoid path traversal and weird filenames
var KID_RE = /^[A-Za-z0-9._-]{1,64}$/;
function ensureKeysDir() {
    var dir = keysDir();
    if (!fs_1.default.existsSync(dir))
        fs_1.default.mkdirSync(dir, { recursive: true, mode: 493 });
}
function pathsForKid(kid) {
    if (!KID_RE.test(kid)) {
        throw new Error("Invalid kid '".concat(kid, "'. Allowed: ").concat(KID_RE));
    }
    var dir = keysDir();
    return {
        priv: path_1.default.join(dir, "".concat(kid, "_private.pem")),
        pub: path_1.default.join(dir, "".concat(kid, "_public.pem")),
    };
}
function readEnvLines() {
    if (!fs_1.default.existsSync(ENV_PATH))
        return [];
    return fs_1.default.readFileSync(ENV_PATH, "utf8").split(/\r?\n/);
}
function writeEnvLines(lines) {
    if (lines.length === 0 || lines[lines.length - 1] !== "")
        lines.push("");
    fs_1.default.writeFileSync(ENV_PATH, lines.join("\n"), { mode: 384 });
}
function getCurrentKid() {
    var lines = readEnvLines();
    var line = lines.find(function (l) { return l.startsWith("".concat(CURRENT_KID_ENV, "=")); });
    return line ? line.split("=", 2)[1] : null;
}
function setCurrentKid(newKid) {
    var lines = readEnvLines();
    var idx = lines.findIndex(function (l) { return l.startsWith("".concat(CURRENT_KID_ENV, "=")); });
    var row = "".concat(CURRENT_KID_ENV, "=").concat(newKid);
    if (idx >= 0)
        lines[idx] = row;
    else
        lines.push(row);
    writeEnvLines(lines);
}
function chmodSafe(file, mode) {
    try {
        fs_1.default.chmodSync(file, mode);
    }
    catch (_a) { }
}
/* ---------------- Redis/JWKS cache (lazy & optional) ---------------- */
function clearJwksCacheIfPossible() {
    return __awaiter(this, void 0, void 0, function () {
        var kv, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 4, , 5]);
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("./redis"); })];
                case 1:
                    kv = (_b.sent()).kv;
                    if (!(kv === null || kv === void 0 ? void 0 : kv.clearJWKS)) return [3 /*break*/, 3];
                    return [4 /*yield*/, kv.clearJWKS()];
                case 2:
                    _b.sent();
                    _b.label = 3;
                case 3:
                    console.log("Cleared JWKS cache.");
                    return [3 /*break*/, 5];
                case 4:
                    _a = _b.sent();
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    });
}
/* ---------------- Core ops ---------------- */
function generateKeyPair(kid, opts) {
    var _a;
    ensureKeysDir();
    var _b = pathsForKid(kid), priv = _b.priv, pub = _b.pub;
    if (!(opts === null || opts === void 0 ? void 0 : opts.overwrite)) {
        if (fs_1.default.existsSync(priv) || fs_1.default.existsSync(pub)) {
            throw new Error("Key files already exist for kid='".concat(kid, "'. Use -f/--overwrite if intended."));
        }
    }
    var modulusLength = (_a = opts === null || opts === void 0 ? void 0 : opts.bits) !== null && _a !== void 0 ? _a : DEFAULT_RSA_BITS;
    var _c = (0, crypto_1.generateKeyPairSync)("rsa", {
        modulusLength: modulusLength,
        publicKeyEncoding: { type: "spki", format: "pem" },
        privateKeyEncoding: { type: "pkcs8", format: "pem" },
    }), publicKey = _c.publicKey, privateKey = _c.privateKey;
    fs_1.default.writeFileSync(priv, privateKey, { mode: 384 });
    fs_1.default.writeFileSync(pub, publicKey, { mode: 420 });
    chmodSafe(priv, 384);
    chmodSafe(pub, 420);
    console.log("Generated key-pair kid='".concat(kid, "' (").concat(modulusLength, " bits) in ").concat(keysDir()));
}
function rotateKey(newKid, opts) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    generateKeyPair(newKid, { bits: opts === null || opts === void 0 ? void 0 : opts.bits });
                    setCurrentKid(newKid);
                    console.log("Rotated CURRENT_KID to '".concat(newKid, "'."));
                    return [4 /*yield*/, clearJwksCacheIfPossible()];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function listKids() {
    var dir = keysDir();
    if (!fs_1.default.existsSync(dir))
        return [];
    var files = fs_1.default.readdirSync(dir).filter(function (f) { return f.endsWith(".pem"); });
    var current = getCurrentKid();
    var set = new Map();
    for (var _i = 0, files_1 = files; _i < files_1.length; _i++) {
        var f = files_1[_i];
        var m = f.match(/^(.*)_(private|public)\.pem$/);
        if (!m)
            continue;
        var kid = m[1], type = m[2];
        if (!KID_RE.test(kid))
            continue;
        var rec = set.get(kid) || { hasPrivate: false, hasPublic: false };
        if (type === "private")
            rec.hasPrivate = true;
        if (type === "public")
            rec.hasPublic = true;
        set.set(kid, rec);
    }
    return Array.from(set.entries()).map(function (_a) {
        var kid = _a[0], v = _a[1];
        return ({
            kid: kid,
            hasPrivate: v.hasPrivate,
            hasPublic: v.hasPublic,
            active: current === kid,
        });
    });
}
function revokeKey(kid) {
    return __awaiter(this, void 0, void 0, function () {
        var current, _a, priv, pub, archiveDir, moved;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    current = getCurrentKid();
                    if (kid === current) {
                        throw new Error("Refusing to revoke CURRENT_KID='".concat(kid, "'. Rotate first, wait for token expiry, then revoke."));
                    }
                    _a = pathsForKid(kid), priv = _a.priv, pub = _a.pub;
                    archiveDir = path_1.default.join(keysDir(), "archive");
                    if (!fs_1.default.existsSync(archiveDir))
                        fs_1.default.mkdirSync(archiveDir, { recursive: true });
                    moved = false;
                    if (fs_1.default.existsSync(priv)) {
                        fs_1.default.renameSync(priv, path_1.default.join(archiveDir, path_1.default.basename(priv)));
                        moved = true;
                        console.log("Archived: ".concat(kid, "_private.pem"));
                    }
                    if (fs_1.default.existsSync(pub)) {
                        fs_1.default.renameSync(pub, path_1.default.join(archiveDir, path_1.default.basename(pub)));
                        moved = true;
                        console.log("Archived: ".concat(kid, "_public.pem"));
                    }
                    if (!!moved) return [3 /*break*/, 1];
                    console.warn("No files found for kid='".concat(kid, "'. Nothing to revoke."));
                    return [3 /*break*/, 3];
                case 1: return [4 /*yield*/, clearJwksCacheIfPossible()];
                case 2:
                    _b.sent();
                    _b.label = 3;
                case 3: return [2 /*return*/];
            }
        });
    });
}
function parseArgv(argv) {
    var args = __spreadArray([], argv, true);
    var flags = {};
    var positionals = [];
    while (args.length) {
        var a = args.shift();
        if (a === "--") {
            positionals.push.apply(positionals, args);
            break;
        }
        if (a === "-f" || a === "--overwrite")
            flags.overwrite = true;
        else if (a === "-s" || a === "--set-active")
            flags.setActive = true;
        else if (a === "--json")
            flags.json = true;
        else if (a === "-b" || a === "--bits")
            flags.bits = Number(args.shift());
        else if (a === "-d" || a === "--dir")
            flags.dir = args.shift();
        else if (a.startsWith("-"))
            throw new Error("Unknown flag: ".concat(a));
        else
            positionals.push(a);
    }
    var cmd = positionals[0], kid = positionals[1];
    return { cmd: cmd, kid: kid, flags: flags };
}
/* ---------------- CLI ---------------- */
if (require.main === module) {
    (function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, cmd, kid, flags, _b, name_1, _c, priv, pub, exists, cur, rows, getJWKS, jwks, e_1;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    _d.trys.push([0, 17, , 18]);
                    _a = parseArgv(process.argv.slice(2)), cmd = _a.cmd, kid = _a.kid, flags = _a.flags;
                    // Allow changing dir at runtime via --dir
                    if (flags.dir)
                        process.env.JWKS_PATH = flags.dir;
                    _b = cmd;
                    switch (_b) {
                        case "help": return [3 /*break*/, 1];
                        case undefined: return [3 /*break*/, 1];
                        case "generate": return [3 /*break*/, 2];
                        case "ensure": return [3 /*break*/, 3];
                        case "rotate": return [3 /*break*/, 4];
                        case "revoke": return [3 /*break*/, 6];
                        case "set-active": return [3 /*break*/, 8];
                        case "show-active": return [3 /*break*/, 10];
                        case "list": return [3 /*break*/, 11];
                        case "jwks": return [3 /*break*/, 12];
                    }
                    return [3 /*break*/, 15];
                case 1:
                    console.log("\nUsage:\n  tsx src/utils/keyManagement.ts <command> [kid] [flags]\n\nCommands:\n  generate <kid>        Generate RSA keypair for <kid>.\n  ensure <kid>          Generate only if missing.\n  rotate  <kid>         Generate new keypair and set CURRENT_KID=<kid>.\n  revoke  <kid>         Archive <kid> (move files to keys/archive). Won't revoke CURRENT_KID.\n  set-active <kid>      Set CURRENT_KID in .env (no file changes).\n  show-active           Print CURRENT_KID from .env.\n  list                  List kids found in JWKS_PATH (or src/keys).\n  jwks                  Print JWKS JSON returned by the service.\n\nFlags:\n  -f, --overwrite       Overwrite existing files on generate.\n  -b, --bits <n>        RSA modulus bits (default env RSA_MODULUS_BITS or 3072).\n  -d, --dir <path>      Keys directory (overrides JWKS_PATH for this run).\n  -s, --set-active      Also set CURRENT_KID=<kid> in .env after generate/ensure.\n      --json            For list/jwks, output JSON only.\n");
                    process.exit(0);
                    _d.label = 2;
                case 2:
                    {
                        name_1 = kid || "auth-key-".concat(Date.now());
                        generateKeyPair(name_1, { overwrite: !!flags.overwrite, bits: flags.bits });
                        if (flags.setActive) {
                            setCurrentKid(name_1);
                            console.log("Set CURRENT_KID=".concat(name_1));
                        }
                        return [3 /*break*/, 16];
                    }
                    _d.label = 3;
                case 3:
                    {
                        if (!kid)
                            throw new Error("Usage: ensure <kid>");
                        _c = pathsForKid(kid), priv = _c.priv, pub = _c.pub;
                        exists = fs_1.default.existsSync(priv) && fs_1.default.existsSync(pub);
                        if (!exists) {
                            generateKeyPair(kid, { overwrite: false, bits: flags.bits });
                            console.log("Created new keypair for '".concat(kid, "'."));
                        }
                        else {
                            console.log("Keypair for '".concat(kid, "' already exists."));
                        }
                        if (flags.setActive) {
                            setCurrentKid(kid);
                            console.log("Set CURRENT_KID=".concat(kid));
                        }
                        return [3 /*break*/, 16];
                    }
                    _d.label = 4;
                case 4:
                    if (!kid)
                        throw new Error("Usage: rotate <newKid>");
                    return [4 /*yield*/, rotateKey(kid, { bits: flags.bits })];
                case 5:
                    _d.sent();
                    return [3 /*break*/, 16];
                case 6:
                    if (!kid)
                        throw new Error("Usage: revoke <kid>");
                    return [4 /*yield*/, revokeKey(kid)];
                case 7:
                    _d.sent();
                    return [3 /*break*/, 16];
                case 8:
                    if (!kid)
                        throw new Error("Usage: set-active <kid>");
                    setCurrentKid(kid);
                    console.log("Set CURRENT_KID=".concat(kid));
                    return [4 /*yield*/, clearJwksCacheIfPossible()];
                case 9:
                    _d.sent();
                    return [3 /*break*/, 16];
                case 10:
                    {
                        cur = getCurrentKid();
                        console.log(cur !== null && cur !== void 0 ? cur : "(none)");
                        return [3 /*break*/, 16];
                    }
                    _d.label = 11;
                case 11:
                    {
                        rows = listKids();
                        if (flags.json)
                            console.log(JSON.stringify(rows, null, 2));
                        else
                            console.table(rows);
                        return [3 /*break*/, 16];
                    }
                    _d.label = 12;
                case 12: return [4 /*yield*/, Promise.resolve().then(function () { return require("../lib/jwt"); })];
                case 13:
                    getJWKS = (_d.sent()).getJWKS;
                    return [4 /*yield*/, getJWKS()];
                case 14:
                    jwks = _d.sent();
                    console.log(JSON.stringify(jwks, null, 2));
                    return [3 /*break*/, 16];
                case 15: throw new Error("Unknown command: ".concat(cmd, ". Try \"help\"."));
                case 16: return [3 /*break*/, 18];
                case 17:
                    e_1 = _d.sent();
                    console.error((e_1 === null || e_1 === void 0 ? void 0 : e_1.message) || e_1);
                    process.exit(1);
                    return [3 /*break*/, 18];
                case 18: return [2 /*return*/];
            }
        });
    }); })();
}
