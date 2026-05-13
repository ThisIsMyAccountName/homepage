"use client";

import Image from "next/image";
import { useState } from "react";

interface ImageGalleryProps {
  images: string[];
  alt: string;
}

export function ImageGallery({ images, alt }: ImageGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  if (images.length === 0) return null;

  return (
    <>
      {/* Main image */}
      <div className="space-y-3">
        <button
          onClick={() => setLightboxOpen(true)}
          className="relative block w-full aspect-video overflow-hidden rounded-lg border border-border bg-card cursor-zoom-in"
        >
          <Image
            src={images[selectedIndex]}
            alt={`${alt} - image ${selectedIndex + 1}`}
            fill
            className="object-contain"
            sizes="(max-width: 768px) 100vw, 800px"
          />
        </button>

        {/* Thumbnails */}
        {images.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {images.map((src, i) => (
              <button
                key={src}
                onClick={() => setSelectedIndex(i)}
                className={`relative h-16 w-24 flex-shrink-0 overflow-hidden rounded border transition-colors ${
                  i === selectedIndex
                    ? "border-accent"
                    : "border-border hover:border-muted"
                }`}
              >
                <Image
                  src={src}
                  alt={`${alt} thumbnail ${i + 1}`}
                  fill
                  className="object-cover"
                  sizes="96px"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 text-white/70 hover:text-white text-2xl"
            aria-label="Close lightbox"
          >
            &times;
          </button>

          {/* Previous button */}
          {images.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedIndex(
                  (selectedIndex - 1 + images.length) % images.length
                );
              }}
              className="absolute left-4 text-white/70 hover:text-white text-3xl"
              aria-label="Previous image"
            >
              &#8249;
            </button>
          )}

          <div className="relative max-h-[90vh] max-w-[90vw] w-full h-full">
            <Image
              src={images[selectedIndex]}
              alt={`${alt} - image ${selectedIndex + 1}`}
              fill
              className="object-contain"
              sizes="90vw"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* Next button */}
          {images.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedIndex((selectedIndex + 1) % images.length);
              }}
              className="absolute right-4 text-white/70 hover:text-white text-3xl"
              aria-label="Next image"
            >
              &#8250;
            </button>
          )}
        </div>
      )}
    </>
  );
}
