import { connectToDB } from "@lib/db";
import Chat from "@models/chat";
import ChatMessage from "@models/message";
import User from "@models/user";
import mongoose from "mongoose";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

export async function GET(request, { params }) {
    try {
        await connectToDB();
        const { user } = await getServerSession();
        // return NextResponse.json({ user, params }, { status: 200 });
        if (!user) {
            return new NextResponse("Unauthenticated");
        }

        const userId = await User.findOne({ email: user.email }).select("_id");

        const { chatId } = params;
        const selectedChat = await Chat.findById(chatId);

        if (!selectedChat) {
            return NextResponse.json({ error: "No chat exists" }, { status: 404 });
        }
        // Add a route for checking wether user is a part of or not
        const userIsPartOfChat = selectedChat.participants.some(
            (id) => String(id) === String(userId._id)
        );

        if (!userIsPartOfChat) {
            return new NextResponse("Unauthorized");
        }

        const messages = await ChatMessage.aggregate([
            {
                $match: {
                    chat: new mongoose.Types.ObjectId(chatId),
                },
            },
            {
                $lookup: {
                    from: "users",
                    foreignField: "_id",
                    localField: "sender",
                    as: "sender",
                    pipeline: [
                        {
                            $project: {
                                avatar: 1,
                                email: 1,
                                name: 1,
                            },
                        },
                    ],
                },
            },
            {
                $addFields: {
                    sender: { $first: "$sender" },
                },
            },
        ]);

        return NextResponse.json({ data: messages }, { status: 201 });
    } catch (error) {
        console.log("[GET_MESSAGES]", error);
        return new NextResponse("Internal Server Error");
    }
}
