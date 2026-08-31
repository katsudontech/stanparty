import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

function readProjectFile(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

function stripSqlLineComments(sql: string) {
  return sql.replace(/--.*$/gm, '');
}

describe('AIにバレるな！お絵かき版の実装回帰', () => {
  it('一筆ごとの描画開始UIを表示しない', () => {
    const canvasSource = readProjectFile(
      'src/games/ai-barenai-drawing/components/Canvas.tsx',
    );

    expect(canvasSource).not.toContain('一筆を描く');
    expect(canvasSource).not.toContain('(pointer: coarse)');
  });

  it('一筆が完成してから描画内容を保存する', () => {
    const canvasSource = readProjectFile(
      'src/games/ai-barenai-drawing/components/Canvas.tsx',
    );

    expect(canvasSource).toContain('onStroke={handleCompletedStroke}');
    expect(canvasSource).toContain('if (activePointerIdRef.current !== null) return;');
    expect(canvasSource).toContain("document.addEventListener('pointerup', finishStroke)");
    expect(canvasSource).not.toContain('canvasRef.current.exportPaths()');
  });

  it('全回答後の判定claimで有効なPostgreSQL関数だけを使う', () => {
    const migrations = [
      'supabase/migrations/20260830000000_ai_barenai_drawing.sql',
      'supabase/migrations/20260831000000_fix_ai_barenai_drawing_progression.sql',
    ].map((path) => stripSqlLineComments(readProjectFile(path)));

    for (const migration of migrations) {
      expect(migration).not.toMatch(/\bjsonb_object_length\s*\(/);
    }

    expect(migrations[1]).toContain("state -> 'answerSubmittedPlayerIds'");
    expect(migrations[1]).toContain('pg_catalog.jsonb_array_length');
  });

  it('描画イベントのINSERT許可がAIにバレるな！お絵かき版に含まれている', () => {
    const migration = stripSqlLineComments(
      readProjectFile('supabase/migrations/20260831100000_fix_ai_barenai_drawing_game_event_permissions.sql'),
    );

    expect(migration).toContain("if new.event_type = 'ai_barenai_drawing_line' then");
    expect(migration).toContain("if new.event_type = 'ai_barenai_drawing_reset' then");
    expect(migration).toContain("target_room.game_type <> 'ai-barenai-drawing'");
  });
});
