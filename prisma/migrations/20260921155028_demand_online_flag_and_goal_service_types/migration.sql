-- AlterTable
ALTER TABLE "DemandRequest" ADD COLUMN     "isOnline" BOOLEAN NOT NULL DEFAULT false;

-- 2026-09-21 服務類型改用目的分類（docs/organizer-flow-redesign-plan.md 決策三）：
-- 把舊的 7 個英文流派名稱轉成新的中文分類。三張表共用同一份清單，所以一起轉換；
-- 不在舊清單裡的值（理論上不存在）維持原樣。
UPDATE "DemandRequest" SET "serviceType" = CASE "serviceType"
  WHEN 'Hatha Yoga' THEN '伸展與身體保養'
  WHEN 'Yin Yoga' THEN '放鬆紓壓'
  WHEN 'Stretch Yoga' THEN '伸展與身體保養'
  WHEN 'Breathwork' THEN '冥想與呼吸'
  WHEN 'Corporate Relaxation Yoga' THEN '放鬆紓壓'
  WHEN 'Beginner Yoga' THEN '還不確定，請老師建議'
  WHEN 'Parent-child Yoga' THEN '特定對象與主題'
  ELSE "serviceType"
END
WHERE "serviceType" IS NOT NULL;

UPDATE "ClassSession" SET "serviceType" = CASE "serviceType"
  WHEN 'Hatha Yoga' THEN '伸展與身體保養'
  WHEN 'Yin Yoga' THEN '放鬆紓壓'
  WHEN 'Stretch Yoga' THEN '伸展與身體保養'
  WHEN 'Breathwork' THEN '冥想與呼吸'
  WHEN 'Corporate Relaxation Yoga' THEN '放鬆紓壓'
  WHEN 'Beginner Yoga' THEN '還不確定，請老師建議'
  WHEN 'Parent-child Yoga' THEN '特定對象與主題'
  ELSE "serviceType"
END
WHERE "serviceType" IS NOT NULL;

UPDATE "RecurringClassSeries" SET "serviceType" = CASE "serviceType"
  WHEN 'Hatha Yoga' THEN '伸展與身體保養'
  WHEN 'Yin Yoga' THEN '放鬆紓壓'
  WHEN 'Stretch Yoga' THEN '伸展與身體保養'
  WHEN 'Breathwork' THEN '冥想與呼吸'
  WHEN 'Corporate Relaxation Yoga' THEN '放鬆紓壓'
  WHEN 'Beginner Yoga' THEN '還不確定，請老師建議'
  WHEN 'Parent-child Yoga' THEN '特定對象與主題'
  ELSE "serviceType"
END
WHERE "serviceType" IS NOT NULL;
