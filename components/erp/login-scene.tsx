"use client";

import { useEffect, useState } from "react";
import { PharmaExperience, StaticPharmaArt } from "@/components/pharma-experience";

const SCENE_QUERY =
  "(min-width: 768px) and (min-height: 700px) and (prefers-reduced-motion: no-preference)";

export function LoginScene() {
  const [showScene, setShowScene] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(SCENE_QUERY);
    const update = () => setShowScene(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  if (!showScene) {
    return (
      <div
        aria-label="Composición estática de un frasco, empaques y cápsulas Farmamed."
        className="relative hidden py-6 sm:[@media(min-height:700px)]:block"
        role="img"
      >
        <div aria-hidden="true" className="absolute -inset-10 rounded-full bg-lime/10 blur-3xl" />
        <StaticPharmaArt className="md:scale-125" />
      </div>
    );
  }

  return <PharmaExperience fill inverse showIndicators={false} />;
}
