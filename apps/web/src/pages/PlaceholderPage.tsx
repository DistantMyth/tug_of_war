import { GAME_PHASES } from "@tow/shared";

type PlaceholderPageProps = {
  title: string;
  route: string;
};

export function PlaceholderPage({ title, route }: PlaceholderPageProps) {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-4 px-6">
      <p className="text-xs tracking-[0.3em] text-cyan-300 uppercase">Tug of War</p>
      <h1 className="text-4xl font-semibold tracking-tight">{title}</h1>
      <p className="text-sm text-zinc-400">
        Route <code className="text-amber-300">{route}</code> is scaffolded. Gameplay ships in later
        phases.
      </p>
      <p className="text-xs text-zinc-500">Phases: {GAME_PHASES.join(" → ")}</p>
    </main>
  );
}
