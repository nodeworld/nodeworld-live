import * as ioredis from "ioredis";
import * as cookie from "cookie";

import { Socket } from "socket.io";

import { io } from "./app";
import { systemMessage, chatMessage, MessageType, MessageDTO } from "./models/message.model";
import { Visitor } from "./models/visitor.model";
import { getNode } from "./utils/api";
import { readToken } from "./utils/jwt";

interface NodeworldSocket extends Socket {
    ctx_node: { id: string, name: string; greeting?: string; }
    visitor: Visitor;
}

const redis = new ioredis(process.env.REDIS_ENDPOINT);
const node_ns_protocol = async (name: string, query: string, next: Function) => {   // Checks if node exists first before handling connection
    try {
        let node_name = name.slice(1);
        if(node_name.charAt(node_name.length-1) === "/") node_name = node_name.slice(0, -1);
        console.log("connecting to " + node_name);
        const node = await getNode(node_name);
        console.log("got node");
        next(null, true);
    } catch(e) {
        console.log(e.message);
        next(e);
    }
}

// @ts-ignore
const node_ns = io.of(node_ns_protocol).on("connect", async (socket: NodeworldSocket) => {
    const local_ns = socket.nsp;
    let name = socket.nsp.name.slice(1);
    if(name.charAt(name.length-1) === "/") name = name.slice(0, -1);
    const cookies = cookie.parse(socket.handshake.headers.cookie);
    const auth_token = cookies["visitor_session"];

    // Connection protocol
    try {
        // Read and assign auth info if token present
        if(auth_token) socket.visitor = await readToken(auth_token) as Visitor;
        console.log(`${socket.visitor ? socket.visitor.name : `guest ${socket.id}`} joined node ${name}`);

        // Retrieve node information
        const node = await getNode(name);   // TODO: Find a way to pass data through node_ns_protocol so I won't have to refetch node information twice

        //Send personal greeting
        socket.emit("message", systemMessage(`Joined ${node.name}.`));
        if(node.greeting) socket.emit("message", systemMessage(node.greeting));

        // Broadcast entrance message to all other visitors
        if(socket.visitor) socket.broadcast.emit("message", systemMessage(`${socket.visitor.name} is here.`));
    } catch(err) {
        socket.emit("message", systemMessage(`Failed to join node. Reason: ${err.message}`));
    }

    // Disconnection protocol: broadcast leaving message to all other visitors
    socket.on("disconnect", (reason: string) => {
        console.log(`${socket.visitor ? socket.visitor.name : `guest ${socket.id}`} left. Reason: ${reason}`);
        if(!socket.visitor) return;
        if(socket.visitor) local_ns.emit("message", systemMessage(`${socket.visitor.name} left.`));
    });

    socket.on("error", (err: any) => {
        console.log(err);
    });
});

// Message handling
const messageLoop = () => (redis as any).brpop("node:message", 0, (err: any, data: any) => {
    const parsed_data = JSON.parse(data[1]);
    console.log(`${parsed_data["message"].name}: ${parsed_data["message"].content}`);
    io.to(parsed_data.node).emit("message", JSON.parse(data[1])["message"]);
    messageLoop();
});
messageLoop();