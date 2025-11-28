import CreateLobbyClient from "./CreateLobbyClient";

type CreatePageProps = {
  searchParams: Promise<{ username?: string }>;
};

export default async function CreatePage({ searchParams }: CreatePageProps) {
  const params = await searchParams;
  const username = params?.username ?? '';
  return <CreateLobbyClient defaultUsername={username} />;
}
