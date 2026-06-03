import { Sidebar } from "@/components/Sidebar";
import { SportsRibbon } from "@/components/SportsRibbon";
import { HeroBanners } from "@/components/HeroBanners";
import { FeaturedStrip } from "@/components/FeaturedStrip";
import { PopularMultiples } from "@/components/PopularMultiples";
import { CenterControls } from "@/components/CenterControls";
import { LeagueGroups } from "@/components/LeagueGroups";
import { BetSlip } from "@/components/BetSlip";
import { MyBets } from "@/components/MyBets";

export default function Home() {
  return (
    <>
      <div className="mx-auto max-w-[1400px] gap-5 px-4 py-5 lg:grid lg:grid-cols-[1fr_340px] xl:grid-cols-[230px_1fr_340px]">
        {/* Navegação (esquerda) — só em telas largas */}
        <aside className="hidden xl:block">
          <div className="sticky top-[4.5rem]">
            <Sidebar />
          </div>
        </aside>

        {/* Eventos (centro) */}
        <main className="min-w-0">
          <SportsRibbon />
          <HeroBanners />
          <FeaturedStrip />
          <PopularMultiples />
          <CenterControls />
          <LeagueGroups />
        </main>

        {/* Bilhete + apostas (direita) — no mobile vira gaveta inferior */}
        <aside className="hidden lg:block">
          <div className="space-y-4 lg:sticky lg:top-[4.5rem]">
            <BetSlip />
            <MyBets />
          </div>
        </aside>
      </div>
    </>
  );
}
