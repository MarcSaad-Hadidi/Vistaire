"use client";

import {
  useId,
  useRef,
  type KeyboardEvent,
  type ReactNode
} from "react";
import type {
  RestaurantExperienceId,
  RestaurantExperienceTab
} from "@/lib/restaurant-experiences/contracts";
import { RESTAURANT_EXPERIENCE_IDS } from "@/lib/restaurant-experiences/contracts";
import styles from "./RestaurantExperienceTabs.module.css";

function isApprovedRestaurantExperienceSet(
  experiences: readonly RestaurantExperienceTab[]
): boolean {
  return (
    experiences.length === RESTAURANT_EXPERIENCE_IDS.length &&
    RESTAURANT_EXPERIENCE_IDS.every(
      (id, index) => experiences[index]?.id === id
    )
  );
}

export function RestaurantExperienceTabs<
  TExperience extends RestaurantExperienceTab
>({
  activeId,
  ariaLabel,
  children,
  experiences,
  onActiveChange
}: {
  activeId: RestaurantExperienceId;
  ariaLabel: string;
  children: ReactNode;
  experiences: readonly TExperience[];
  onActiveChange: (id: RestaurantExperienceId) => void;
}) {
  const instanceId = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const hasApprovedExperiences = isApprovedRestaurantExperienceSet(experiences);
  const activeIndex = experiences.findIndex((experience) => experience.id === activeId);
  const selectedIndex = activeIndex === -1 ? 0 : activeIndex;
  const selectedExperience = experiences[selectedIndex];
  const panelId = `${instanceId}-panel`;

  const activate = (index: number, focus = false) => {
    if (!experiences.length) return;
    const normalizedIndex = (index + experiences.length) % experiences.length;
    const experience = experiences[normalizedIndex];
    if (!experience) return;
    onActiveChange(experience.id);
    if (focus) tabRefs.current[normalizedIndex]?.focus();
  };

  const onTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number
  ) => {
    switch (event.key) {
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        activate(index - 1, true);
        break;
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        activate(index + 1, true);
        break;
      case "Home":
        event.preventDefault();
        activate(0, true);
        break;
      case "End":
        event.preventDefault();
        activate(experiences.length - 1, true);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        activate(index);
        break;
      default:
        break;
    }
  };

  if (!hasApprovedExperiences || !selectedExperience) return null;

  return (
    <div className={styles.root}>
      <div aria-label={ariaLabel} className={styles.tabList} role="tablist">
        {experiences.map((experience, index) => {
          const selected = index === selectedIndex;
          const tabId = `${instanceId}-${experience.id}-tab`;
          return (
            <button
              aria-controls={panelId}
              aria-selected={selected}
              className={styles.tab}
              id={tabId}
              key={experience.id}
              onClick={() => activate(index)}
              onKeyDown={(event) => onTabKeyDown(event, index)}
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              role="tab"
              tabIndex={selected ? 0 : -1}
              type="button"
            >
              {experience.name}
            </button>
          );
        })}
      </div>
      <div
        aria-labelledby={`${instanceId}-${selectedExperience.id}-tab`}
        className={styles.panel}
        id={panelId}
        role="tabpanel"
      >
        {children}
      </div>
    </div>
  );
}
