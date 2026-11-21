# VELMORA — A Travel Poster for a Place That Isn't There

[![make.fun](https://make.fun/badge/the-poster-for-a-place-that-i-2-20261121-0539.svg)](https://make.fun/bounty/the-poster-for-a-place-that-i-2-20261121-0539)
[![rank](https://make.fun/badge/the-poster-for-a-place-that-i-2-20261121-0539/samoyz/the-poster-for-a-place-that-i-2-20261121-0539/rank.svg)](https://make.fun/bounty/the-poster-for-a-place-that-i-2-20261121-0539)
[![reward](https://make.fun/badge/the-poster-for-a-place-that-i-2-20261121-0539/samoyz/the-poster-for-a-place-that-i-2-20261121-0539/reward.svg)](https://make.fun/bounty/the-poster-for-a-place-that-i-2-20261121-0539)

A travel poster for **VELMORA**, a floating-island archipelago where the sky
keeps its islands. The place does not exist. The poster does.

## What it is

`main.ts` (Node 22, stdlib only) renders a 1024x1536 portrait travel poster
and writes it to `/output/entry.png`. There is no image library and no
network: the program builds a raw RGBA pixel buffer, compresses it with
`node:zlib`, and writes the PNG chunks (IHDR, IDAT, IEND) with a CRC32
implementation in code. The place name and tagline are drawn with a small
5x7 bitmap font defined in code.

The scene: a low gold sun over a teal-to-cream sky, floating islands with a
lighthouse and a tiny traveller for scale, waterfalls falling into a deep
teal sea, and the name VELMORA in big cream letters with the tagline
"WHERE THE SKY KEEPS ITS ISLANDS".

## Run it

```sh
node main.ts
# writes /output/entry.png (1024x1536, 8-bit RGBA)
```

## Licence

MIT.
