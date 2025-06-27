"use client";
import React from "react";
import { ShootingStars } from "@/components/ui/ShootingStars";
import { StarsBackground } from "@/components/ui/StarsBackground";
import { TextHoverEffect } from "@/components/ui/TextHover";
import { CardSpotlight } from "@/components/ui/CardSpotlight";
import { StickyScroll } from "@/components/ui/StickyScrollReveal";


export default function ShootingStarsAndStarsBackgroundDemo() {

  const content = [
    {
      title: "Real time changes",
      description:
        "See changes as they happen. With our platform, you can track every modification in real time. No more confusion about the latest version of your project. Say goodbye to the chaos of version control and embrace the simplicity of real-time updates.",
      content: (
        <div className="flex h-full w-full items-center justify-center text-white">
          <img
            src="/linear.webp"
            width={300}
            height={300}
            className="h-full w-full object-cover"
            alt="linear board demo"
          />
        </div>
      ),
    },
    {
      title: "Version control",
      description:
        "Experience real-time updates and never stress about version control again. Our platform ensures that you're always working on the most recent version of your project, eliminating the need for constant manual updates. Stay in the loop, keep your team aligned, and maintain the flow of your work without any interruptions.",
      content: (
        <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(to_bottom_right,var(--orange-500),var(--yellow-500))] text-white">
          Version control
        </div>
      ),
    },
    {
      title: "Collaborative Editing",
      description:
        "Work together in real time with your team, clients, and stakeholders. Collaborate on documents, share ideas, and make decisions quickly. With our platform, you can streamline your workflow and increase productivity.",
      content: (
        <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(to_bottom_right,var(--cyan-500),var(--emerald-500))] text-white">
          Collaborative Editing
        </div>
      ),
    },
    
  ];

  return (
    <div className="bg-neutral-900">
      <div className="h-screen bg-neutral-900 flex flex-col items-center justify-center relative w-full">
      <ShootingStars />
      <StarsBackground />
      <TextHoverEffect text="Refr" />
      </div>

      <div className="w-full bg-neutral-900 flex items-center justify-center pt-12">
        <h1 className="text-5xl font-extrabold text-white tracking-tight">THE PROBLEM</h1>
      </div>
      <div className="h-min bg-neutral-900 flex flex-row items-center justify-center relative w-full">
        <CardSpotlight className="h-96 w-96 m-24">
          <p className="text-xl font-bold relative z-20 mt-2 text-white">
            Find New Connections
          </p>
          <p className="text-neutral-300 mt-4 relative z-20 text-sm">
            Ensuring your account is properly secured helps protect your personal
            information and data.
          </p>
        </CardSpotlight>
        <CardSpotlight className="h-96 w-96 m-24">
          <p className="text-xl font-bold relative z-20 mt-2 text-white">
            Find New Connections
          </p>
          <p className="text-neutral-300 mt-4 relative z-20 text-sm">
            Ensuring your account is properly secured helps protect your personal
            information and data.
          </p>
        </CardSpotlight>
        <CardSpotlight className="h-96 w-96 m-24">
          <p className="text-xl font-bold relative z-20 mt-2 text-white">
            Find New Connections
          </p>
          <p className="text-neutral-300 mt-4 relative z-20 text-sm">
            Ensuring your account is properly secured helps protect your personal
            information and data.
          </p>
        </CardSpotlight>
      </div>

      <div className="w-full bg-neutral-900 flex items-center justify-center pt-12">
        <h1 className="text-5xl font-extrabold text-white tracking-tight">THE SOLUTION</h1>
      </div>
      <div className="h-min bg-neutral-900">
        <StickyScroll content={content} />
      </div>
    </div>
  );
}
