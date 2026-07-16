-- Stage F1: notice 에 작성자 감사(auditing) 컬럼 추가(BaseEntity createdBy/modifiedBy).
-- 기존 행은 NULL(인증 컨텍스트 없이 생성된 데이터). 이미 적용된 V1 은 수정하지 않고 새 버전으로 추가.
ALTER TABLE notice
    ADD COLUMN created_by  VARCHAR(100) NULL,
    ADD COLUMN modified_by VARCHAR(100) NULL;
