// src/app/create/page.tsx
import CreateLobbyClient from "../createLobbyClient";

type CreatePageProps = {
  searchParams?: { username?: string };
};

export default function CreatePage({ searchParams }: CreatePageProps) {
  const username = searchParams?.username ?? '';
  return <CreateLobbyClient defaultUsername={username} />;
}
