import { RepoHome } from "@/components/repo/repo-home";

export default async function RepoPage({ params }: { params: Promise<{ repoId: string }> }) {
  const { repoId } = await params;
  return <RepoHome repoId={repoId} />;
}
