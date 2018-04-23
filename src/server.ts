import * as ioredis from "ioredis";

import { Socket } from "socket.io";

import { io } from "./app";
import { chatMessage, MessageDTO, MessageType, systemMessage } from "./models/message.model";
import { Visitor } from "./models/visitor.model";
import { getNode } from "./utils/api";
import { readToken } from "./utils/jwt";
import { logger } from "./utils/log";

interface NodeworldSocket extends Socket {
    ctxNode: { id: string, name: string; greeting?: string; };
    visitor?: Visitor;
    name: string;
}

const redis = new ioredis({ host: process.env.REDIS_ENDPOINT });
const nodeNamespaceProtocol = async (
    name: string,
    query: string,
    next: any,
) => {   // Checks if node exists first before handling connection
    try {
        let nodeName = name.slice(1);
        if (nodeName.charAt(nodeName.length - 1) === "/") nodeName = nodeName.slice(0, -1);
        const node = await getNode(nodeName);
        next(null, true);
    } catch (e) {
        logger.warn(e.message);
        next(e);
    }
};

// @ts-ignore
const nodeNs = io.of(nodeNamespaceProtocol).on(
    "connect",
    async (socket: NodeworldSocket) => {
        const localNs = socket.nsp;
        const nodeName = localNs.name.slice(
            1,
            localNs.name.charAt(localNs.name.length - 1) === "/" ? -1 : undefined,
        );

        const getVisitors = () => {
            logger.debug("Generating connections list...");
            const visitors: Visitor[] = [];
            Object.keys(localNs.sockets).forEach((key) => {
                const s = localNs.sockets[key] as NodeworldSocket;
                if (s.visitor) visitors.push(s.visitor);
            });
            logger.debug(`Connections list generated with ${visitors.length} visitor(s).`);
            return visitors;
        };

        const authenticateSocket = async (s: NodeworldSocket): Promise<Visitor> => {
            logger.debug(`Authenticating ${s.id}...`);
            const token = s.request.signedCookies.visitor_session;
            if (!token) throw new Error("Undefined token.");
            return await readToken(token);
        };

        // Connection protocol
        try {
            // Read and assign auth info if token present
            logger.info(`${socket.id} joined node ${nodeName}`);
            try {
                socket.visitor = await authenticateSocket(socket);
            } catch (e) { logger.debug("Authentication failed. Socket has anonymous access."); }
            if (socket.visitor) logger.info(`${socket.id} authenticated as ${socket.visitor.name}`);
            socket.name = socket.visitor ? socket.visitor.name : `guest ${socket.id}`;

            // Retrieve node information
            // TODO: Find a way to pass data through nodeNamespaceProtocol
            //       so node information will not have to be fetched twice
            const node = await getNode(nodeName);

            // Send personal greeting
            socket.emit("message", systemMessage(`Joined ${node.name}.`));
            if (node.greeting) socket.emit("message", systemMessage(node.greeting));

            // Retrieve and send list of visitors in current node
            localNs.emit("visitors", getVisitors());

            // Let client know connection protocol is finished
            socket.emit("joined");

            // Broadcast entrance message to all other visitors
            if (socket.visitor) {
                socket.broadcast.emit("message", systemMessage(`${socket.visitor.name} is here.`));
            }
        } catch (err) {
            socket.emit("message", systemMessage(`Failed to join node. Reason: ${err.message}`));
            logger.info(`${socket.name} failed to join node ${nodeName}. Reason: ${err.message}`);
        }

        // Login protocol: attempt to reauthenticate and update connected list
        socket.on("login", async () => {
            logger.debug(`${socket.name} sent LOGIN. Attempting to authenticate socket...`);
            try {
                socket.visitor = await authenticateSocket(socket);
                logger.debug("Authentication succeeded. Updating connections state...");
                localNs.emit("visitors", getVisitors());
            } catch { logger.debug("Authentication failed. Connections state not updated."); }
        });

        socket.on("logout", async () => {
            logger.debug(`${socket.name} sent LOGOUT. Setting socket access to anonymous...`);
            socket.visitor = undefined;
            logger.debug("Updating connections list...");
            localNs.emit("visitors", getVisitors());
        });

        // Disconnection protocol: broadcast leaving message to all other visitors
        socket.on("disconnect", (reason: string) => {
            logger.debug(`${socket.name} left. Reason: ${reason}`);
            if (socket.visitor) {
                localNs.emit("message", systemMessage(`${socket.visitor.name} left.`));
            }
            localNs.emit("visitors", getVisitors());
        });

        // Error protocol: standard error-handling
        socket.on("error", (err: any) => {
            logger.error(err);
        });
    },
);

// Message handling
const messageLoop = () => (redis as any).brpop("node:message", 0, (err: any, data: any) => {
    const parsedData = JSON.parse(data[1]);
    logger.debug(`${parsedData.message.name}: ${parsedData.message.content}`);
    io.of(`/${parsedData.node}`).emit("message", parsedData.message);
    messageLoop();
});
messageLoop();
