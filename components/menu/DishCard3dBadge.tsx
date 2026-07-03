import styles from "./DishCard3dBadge.module.css";

type DishCard3dBadgeProps = {
  className?: string;
};

export function DishCard3dBadge({ className }: DishCard3dBadgeProps = {}) {
  return (
    <span
      className={[styles.badge, className].filter(Boolean).join(" ")}
      aria-hidden="true"
    >
      <svg
        className={styles.icon}
        viewBox="0 0 16 16"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M8 1.5 2.5 4.75v6.5L8 14.5l5.5-3.25v-6.5L8 1.5Z"
          fill="none"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.1"
        />
        <path
          d="M8 1.5v13M2.5 4.75 8 8l5.5-3.25M8 8v6.5"
          fill="none"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.1"
        />
      </svg>
      <span className={styles.label}>3D</span>
    </span>
  );
}
