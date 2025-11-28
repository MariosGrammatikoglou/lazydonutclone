// src/app/join/page.tsx
import JoinLobbyClient from './JoinLobbyClient';

type JoinPageProps = {
  searchParams?: { username?: string };
};

export default function JoinPage({ searchParams }: JoinPageProps) {
  const username = searchParams?.username ?? '';
  return <JoinLobbyClient defaultUsername={username} />;
}
