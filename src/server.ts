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

io.on("connection", async (socket: NodeworldSocket) => {
    const { node, subnode } = socket.handshake.query;
    const cookies = cookie.parse(socket.handshake.headers.cookie);
    const auth_token = cookies["visitor_session"];
    const channel = subnode ? `${node}:${subnode}` : `${node}`;

    // Connection protocol
    try {
        // Authenticate visitor
        //if(!auth_token) throw new Error("Not logged in.");
        //const visitor = await readToken(auth_token) as Visitor;
        //socket.visitor = visitor;

        if(auth_token) socket.visitor = await readToken(auth_token) as Visitor;
        console.log(`${socket.visitor ? socket.visitor.name : `guest ${socket.id}`} joined node ${channel}`);
    
        // Ensure node is defined
        if(!node) throw new Error("Node is unspecified.");

        // Join room
        socket.join(channel);

        // Retrieve node information for personal greeting
        const node_data = await getNode(node);
        socket.ctx_node = node_data;

        // Send personal greeting
        socket.emit("message", systemMessage(`Joined ${node_data.name}.`));
        if(node_data.greeting) socket.emit("message", systemMessage(node_data.greeting));

        // Broadcast entrance message to all other visitors
        if(socket.visitor) socket.to(channel).emit("message", systemMessage(`${socket.visitor.name} is here.`));
    } catch(err) {
        socket.emit("message", systemMessage(`Failed to join node. Reason: ${err.message}`));
    }

    // Upon disconnect, broadcast leaving message to all other visitors
    socket.on("disconnect", (reason: string) => {
        console.log(`${socket.visitor ? socket.visitor.name : `guest ${socket.id}`} left. Reason: ${reason}`);
        if(!socket.visitor) return;
        if(socket.visitor) socket.to(channel).emit("message", systemMessage(`${socket.visitor.name} left.`));
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