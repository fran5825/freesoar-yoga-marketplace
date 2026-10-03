-- 2026-10-03 文案統一：選項與文案一律寫「瑜伽」，不寫「瑜珈」（docs/context/voice-and-tone.md）。
-- 只轉換資料、不改欄位結構：老師擅長類型、單堂課與系列課的瑜伽類型，所有值裡的「瑜珈」換成「瑜伽」。
-- 換完若同一筆出現重複值（例如同時存了「陰瑜珈」與「陰瑜伽」），只保留第一次出現的那個，順序不變。

UPDATE "TeacherProfile"
SET "specialties" = ARRAY(
  SELECT v FROM (
    SELECT replace(item, '瑜珈', '瑜伽') AS v, min(ord) AS first_ord
    FROM unnest("specialties") WITH ORDINALITY AS t(item, ord)
    GROUP BY 1
  ) deduped
  ORDER BY first_ord
)
WHERE array_to_string("specialties", '|') LIKE '%瑜珈%';

UPDATE "ClassSession"
SET "yogaStyles" = ARRAY(
  SELECT v FROM (
    SELECT replace(item, '瑜珈', '瑜伽') AS v, min(ord) AS first_ord
    FROM unnest("yogaStyles") WITH ORDINALITY AS t(item, ord)
    GROUP BY 1
  ) deduped
  ORDER BY first_ord
)
WHERE array_to_string("yogaStyles", '|') LIKE '%瑜珈%';

UPDATE "RecurringClassSeries"
SET "yogaStyles" = ARRAY(
  SELECT v FROM (
    SELECT replace(item, '瑜珈', '瑜伽') AS v, min(ord) AS first_ord
    FROM unnest("yogaStyles") WITH ORDINALITY AS t(item, ord)
    GROUP BY 1
  ) deduped
  ORDER BY first_ord
)
WHERE array_to_string("yogaStyles", '|') LIKE '%瑜珈%';
