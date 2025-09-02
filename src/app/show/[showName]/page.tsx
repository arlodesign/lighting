export default async function ShowPage({
  params,
}: {
  params: Promise<{ showName: string }>;
}) {
  const { showName } = await params;
  return <div>My Post: {showName}</div>;
}
