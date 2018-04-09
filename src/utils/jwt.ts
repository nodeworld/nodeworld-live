import * as jwt from "jsonwebtoken";
import * as fs from "fs";

const PUBLIC_KEY_PATH = process.env.PUBLIC_KEY_PATH;

if(!PUBLIC_KEY_PATH) throw new Error("JWT public key path is undefined.");

const PUBLIC_KEY = fs.readFileSync(PUBLIC_KEY_PATH);

export const readToken = (token: string) => jwt.verify(token, PUBLIC_KEY, { algorithms: ["RS256"] });