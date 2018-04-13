import * as jwt from "jsonwebtoken";
import * as fs from "fs";

import { promisify } from "util";

const read = promisify(fs.readFile);

const PUBLIC_KEY_PATH = process.env.PUBLIC_KEY_PATH;

if(!PUBLIC_KEY_PATH) throw new Error("JWT public key path is undefined.");

let PUBLIC_KEY;

export const readToken = async (token: string): Promise<any> => {
    PUBLIC_KEY = await read(PUBLIC_KEY_PATH);
    return jwt.verify(token, PUBLIC_KEY, { algorithms: ["RS256"] });
}