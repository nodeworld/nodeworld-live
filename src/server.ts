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
    visitor?: Visitor;
}

const redis = new ioredis({ host: process.env.REDIS_ENDPOINT });
const node_ns_protocol = async (name: string, query: string, next: Function) => {   // Checks if node exists first before handling connection
    try {
        let node_name = name.slice(1);
        if(node_name.charAt(node_name.length-1) === "/") node_name = node_name.slice(0, -1);
        const node = await getNode(node_name);
        next(null, true);
    } catch(e) {
        console.log(e.message);
        next(e);
    }
}

// @ts-ignore
const node_ns = io.of(node_ns_protocol).on("connect", async (socket: NodeworldSocket) => {
    const local_ns = socket.nsp;
    const name = local_ns.name.slice(1, local_ns.name.charAt(local_ns.name.length-1) === "/" ? -1 : undefined);

    const getVisitors = () => {
        let visitors: Visitor[] = [];
        Object.keys(local_ns.sockets).forEach((key) => {
            const socket = local_ns.sockets[key] as NodeworldSocket;
            if(socket.visitor) visitors.push(socket.visitor);
        });
        return visitors;
    }

    const authenticateSocket = async (s: NodeworldSocket): Promise<Visitor> => {
        const cookies = cookie.parse(s.handshake.headers.cookie);
        const token = cookies["visitor_session"];
        if(token) return await readToken(token); else throw new Error("Undefined token.");
    }

    // Connection protocol
    try {
        // Read and assign auth info if token present
        try { socket.visitor = await authenticateSocket(socket); } catch { }
        console.log(`${socket.visitor ? socket.visitor.name : `guest ${socket.id}`} joined node ${name}`);

        // Retrieve node information
        const node = await getNode(name);   // TODO: Find a way to pass data through node_ns_protocol so I won't have to refetch node information twice

        // Send personal greeting
        socket.emit("message", systemMessage(`Joined ${node.name}.`));
        if(node.greeting) socket.emit("message", systemMessage(node.greeting));

        // Retrieve and send list of visitors in current node
        local_ns.emit("visitors", getVisitors());

        // Let client know connection protocol is finished
        socket.emit("joined");

        // Broadcast entrance message to all other visitors
        if(socket.visitor) socket.broadcast.emit("message", systemMessage(`${socket.visitor.name} is here.`));
    } catch(err) {
        socket.emit("message", systemMessage(`Failed to join node. Reason: ${err.message}`));
    }

    // Login protocol: attempt to reauthenticate and update connected list
    socket.on("login", async () => {
        try {
            socket.visitor = await authenticateSocket(socket);
            local_ns.emit("visitors", getVisitors());
        } catch { }
    });

    socket.on("logout", async () => {
        socket.visitor = undefined;
        local_ns.emit("visitors", getVisitors());
    });

    // Disconnection protocol: broadcast leaving message to all other visitors
    socket.on("disconnect", (reason: string) => {
        console.log(`${socket.visitor ? socket.visitor.name : `guest ${socket.id}`} left. Reason: ${reason}`);
        if(socket.visitor) local_ns.emit("message", systemMessage(`${socket.visitor.name} left.`));
        local_ns.emit("visitors", getVisitors());
    });

    // Error protocol: standard error-handling
    socket.on("error", (err: any) => {
        console.log(err);
    });
});

// Message handling
const messageLoop = () => (redis as any).brpop("node:message", 0, (err: any, data: any) => {
    const parsed_data = JSON.parse(data[1]);
    console.log(`${parsed_data["message"].name}: ${parsed_data["message"].content}`);
    io.of(`/${parsed_data.node}`).emit("message", parsed_data.message);
    messageLoop();
});
messageLoop();