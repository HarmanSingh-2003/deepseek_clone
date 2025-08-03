import { Webhook } from "svix";
import connectDB from "@/config/db";
import User from "@/models/User";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(req) {
    try {
        const wh = new Webhook(process.env.SIGNING_SECRET);
        const headerPayload = await headers();
        const svixHeaders = {
            "svix-id": headerPayload.get("svix-id"),
            "svix-timestamp": headerPayload.get("svix-timestamp"),
            "svix-signature": headerPayload.get("svix-signature"),
        };

        // Get the payload and verify it
        const payload = await req.json();
        const body = JSON.stringify(payload);
        const { data, type } = wh.verify(body, svixHeaders);

        // Make the data extraction more robust
        const userData = {
            _id: data.id,
            email: data.email_addresses?.[0]?.email_address || null, // Safely get the email, or null if not available
            name: `${data.first_name || ""} ${data.last_name || ""}`.trim(), // Handle potential missing names
            image: data.image_url,
        };

        await connectDB();

        switch (type) {
            case "user.created":
                if (userData.email) { // Only attempt to create if a valid email exists
                    await User.create(userData);
                    console.log(`User created: ${userData.email}`);
                } else {
                    console.warn("User created event received without a primary email address. Skipping database entry.");
                }
                break;

            case "user.updated":
                if (userData.email) { // Only attempt to update if a valid email exists
                    await User.findByIdAndUpdate(data.id, userData);
                    console.log(`User updated: ${userData.email}`);
                }
                break;

            case "user.deleted":
                await User.findByIdAndDelete(data.id);
                console.log(`User deleted: ${data.id}`);
                break;

            default:
                console.log(`Unhandled event type: ${type}`);
                break;
        }

        return NextResponse.json({
            message: "Event received",
        });

    } catch (error) {
        console.error("Webhook processing failed:", error);
        return NextResponse.json({
            message: "Error processing webhook",
            error: error.message,
        }, { status: 500 });
    }
}