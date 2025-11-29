# **App Name**: WaCRM

## Core Features:

- User Authentication: Secure user authentication using Firebase Authentication with email/password and custom role claims (ADMIN/AGENT).
- WhatsApp Session Management: Creation, management, and monitoring of WhatsApp sessions, including QR code generation, status checks, and disconnection capabilities.
- Real-time Chat Interface: A real-time chat interface using Firestore listeners, allowing users to send and receive text, images, videos, audio, and documents. It include support for RTL (Right-to-Left) languages such as Arabic.
- AI-Powered Chatbot: An AI-powered chatbot that can respond to customer inquiries, provide support, and automate tasks, leveraging the OpenAI API (gpt-4o-mini) with contextual awareness as a tool.
- CRM Functionality: Management of contacts and categories, enabling agents to organize and segment their customer base. Maintain history of past conversations.
- Dashboard Analytics: A dashboard displaying key metrics such as conversation statistics, response rates, and active bots, offering insights into customer engagement.
- File Upload and Management: Users are able to upload media files, store those in Firebase storage, attach and send those in the Whatsapp messages.

## Style Guidelines:

- Primary color: Saturated teal (#008080) to evoke trust and communication.
- Background color: Light greenish-gray (#E0EBEB) to create a calm, neutral backdrop.
- Accent color: Yellow-green (#ADFF2F) to draw attention to calls to action and important information.
- Body text: 'PT Sans' sans-serif font for a modern and clean user interface.
- Headline text: 'Space Grotesk' sans-serif font for titles.
- Font Awesome icons for a consistent and professional look, emphasizing clarity and ease of understanding.
- A modern, grid-based layout optimized for RTL (right-to-left) languages, ensuring a seamless user experience for Arabic-speaking users.