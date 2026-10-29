"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon/Icon";
import styles from "./sortable.module.css";

/**
 * A list put in order by dragging, or by its buttons: the buttons do the same
 * with a keyboard or on a phone, where dragging is unreliable. Each move is
 * announced, so a screen reader hears where the item went.
 *
 * Built on the browser's own drag and drop rather than a library: a single
 * column of rows needs nothing more.
 */
export function SortableList<T>({
  items,
  getId,
  getLabel,
  render,
  onChange,
  label,
}: {
  items: T[];
  getId: (item: T) => string;
  getLabel: (item: T) => string;
  render: (item: T, index: number) => React.ReactNode;
  onChange: (next: T[]) => void;
  label: string;
}) {
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= items.length) return;
    const next = [...items];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item!);
    onChange(next);
    setAnnouncement(`${getLabel(item!)} moved to position ${to + 1} of ${items.length}.`);
  };

  return (
    <>
      <ol className={styles.list} aria-label={label}>
        {items.map((item, index) => (
          <li
            key={getId(item)}
            className={`${styles.row} ${dragging === index ? styles.dragging : ""} ${over === index && dragging !== index ? styles.over : ""}`}
            draggable
            onDragStart={(e) => {
              setDragging(index);
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", getId(item));
            }}
            onDragOver={(e) => {
              e.preventDefault();
              if (over !== index) setOver(index);
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragging !== null) move(dragging, index);
              setDragging(null);
              setOver(null);
            }}
            onDragEnd={() => {
              setDragging(null);
              setOver(null);
            }}
          >
            <span className={styles.handle} aria-hidden="true">
              <Icon name="grip" />
            </span>
            <span className={styles.position}>{index + 1}</span>
            <div className={styles.content}>{render(item, index)}</div>
            <span className={styles.buttons}>
              <button type="button" className="btn btn-icon btn-secondary" disabled={index === 0} onClick={() => move(index, 0)} aria-label={`Move ${getLabel(item)} to the top`}>
                <Icon name="arrowUpToLine" />
              </button>
              <button type="button" className="btn btn-icon btn-secondary" disabled={index === 0} onClick={() => move(index, index - 1)} aria-label={`Move ${getLabel(item)} up`}>
                <Icon name="arrowUp" />
              </button>
              <button type="button" className="btn btn-icon btn-secondary" disabled={index === items.length - 1} onClick={() => move(index, index + 1)} aria-label={`Move ${getLabel(item)} down`}>
                <Icon name="arrowDown" />
              </button>
            </span>
          </li>
        ))}
      </ol>
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
    </>
  );
}
