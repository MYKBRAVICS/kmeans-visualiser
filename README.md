# Interactive k-means explainer

**[Open the live demo →](https://mykbravics.github.io/kmeans-visualiser/)**

A browser-based walkthrough of k-means, built for an audience of biologists
rather than statisticians. One HTML file, no dependencies, no build step,
works offline.

---

## Why this exists

I built this while preparing to defend a clustering analysis of dairy cow
biomarker trajectories. The room understood lactation physiology; it did not
necessarily accept being told that an algorithm had found four groups. The
questions were the right ones:

- Where do the starting centroids come from, and does the answer change if
  they move?
- How do you know it is four groups and not three?
- What stops the algorithm from finding groups in data that has none?

A static slide answers none of those. Letting people move the points and watch
the clusters shift answers all three in about ninety seconds.

---

## What it does

**Step through the algorithm.** Assign, update, repeat, converge — one click
per half-step, or run to convergence. For the first two iterations it draws a
line from every point to its centroid, because "each point joins its nearest
centroid" is the thing being explained and it stops being interesting once it
is understood.

**Move the starting centroids.** Press it a few times on the overlapping data
and rerun. The final grouping changes. On the separated dataset, **58% of
random starts land in a local minimum** — measured, and asserted in the test
suite. This is why real implementations restart from many seeds.

**Change k live,** and watch the panel below respond.

**The k curve** shows the best result at each k from 2 to 8, using twelve
restarts. Silhouette is the prominent line; within-cluster sum of squares is
drawn quietly behind it, because the elbow method always slopes downward and
answers less than people expect.

The restarts are not decoration. A single random start does **not** guarantee
that within-cluster SS falls as k rises — a bad seed at k=5 can score worse
than a good seed at k=4, making the elbow appear to bend the wrong way. That
property belongs to the best solution at each k, not to any one run. The test
suite asserts it on all three datasets.

**Three datasets:** well-separated groups, overlapping groups, and uniform
noise.

**Click anywhere on the plot** to add your own points.

---

## The noise dataset is the point

Load it and run it. There are no groups in that data at all, and the algorithm
returns k tidy ones anyway, every time, with boundaries that look deliberate.

It scores a silhouette of **0.40** at k=4 — a positive number, from nothing.
And on the k curve it keeps climbing all the way to k=8 without ever settling,
which is the signature of an algorithm subdividing noise.

That is what makes the absolute silhouette value close to meaningless on its
own. The honest comparison is against what the same algorithm returns from
data you know has no structure, which is exactly the null benchmark used in
[lactation-trajectory-clustering](https://github.com/MYKBRAVICS/lactation-trajectory-clustering).

---

## Design notes

Cluster colours are the **Okabe-Ito** palette, the colour-vision-safe
qualitative set used in most journal figure guidance. Roughly one man in
twelve has red-green colour blindness, and a teaching tool where two clusters
are indistinguishable to part of the room is not a teaching tool.

Colour appears only inside the plot. Everything else is monochrome, so nothing
competes with the thing the eye is supposed to follow.

---

## Tests

```bash
node tests/kmeans.test.mjs
