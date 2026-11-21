"use client";

import { Component, type ReactNode } from "react";

/**
 * Without WebGL (old hardware, some locked-down browsers) the floor cannot draw. The app works
 * without it, so the floor is dropped quietly and the panels stay usable on the plain background.
 */
export class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(error: Error): void {
    console.error("The 3D floor could not start, so it is hidden:", error.message);
  }

  override render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}
