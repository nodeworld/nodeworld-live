import * as request from "request-promise";

import { Message } from "../models/message.model";
import { Node } from "../models/node.model";


const API_ENDPOINT = process.env.API_ENDPOINT || "http://localhost:2000";

export const getNode = async (name: string): Promise<Node> => {
    const data = await request.get(`${API_ENDPOINT}/nodes?name=${name}&limit=1`, { json: true });
    return data.nodes[0];
}