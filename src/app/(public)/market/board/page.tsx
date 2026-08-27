import MarketBoard from "./market-board";

export const metadata = {
  title: "Drinks Exchange | Don Fenticas",
  description: "Live drinks market board - prices rise and fall all night.",
  robots: { index: false },
};

export default function MarketBoardPage() {
  return (
    <main className="min-h-dvh w-full bg-[#14180a] text-white antialiased">
      <style
        dangerouslySetInnerHTML={{
          __html: `html, body { background-color: #14180a !important; margin: 0; padding: 0; overflow-x: hidden; }`,
        }}
      />
      <MarketBoard />
    </main>
  );
}
