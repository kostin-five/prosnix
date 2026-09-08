# Data model

Новая persistence model не требуется. Используются существующие:

- analytics profile: average/rise, sequence effects и comparison progress;
- session history: baseline, post-rating, completedAt;
- Coach insight: summary, nextExperiment, caveat и evidence count.

UI-ряд графика вычисляется как `postRating - baseline` максимум для семи последних элементов и не
сохраняется.
