export enum MessageType {
    SYSTEM = 0,
    CHAT = 1,
    ACTION = 2
}

export interface Message {
    name?: string;
    type: MessageType;
    content: string;
}

export interface MessageDTO {
    message: string;
    node: string;
}

export const systemMessage = (content: string): Message => ({
    type: MessageType.SYSTEM,
    content
});

export const chatMessage = (name: string, content: string): Message => ({
    type: MessageType.CHAT,
    name,
    content
})