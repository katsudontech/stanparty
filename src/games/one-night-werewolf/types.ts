export type OneNightPhase =
    | "rule_setting"
    | "night_phase"
    | "day_phase"
    | "vote_phase"
    | "result"

export type OneNightRole =
    | "werewolf"
    | "villager"
    | "seer"
    | "robber"


export interface OneNightPlayerState {
    initialRole: OneNightRole;
    currentRole: OneNightRole;
}

export interface OneNightRuleSettings {
    roles: OneNightRole[];
    timeLimit: number;
}

export interface OneNightGameState {
    phase: OneNightPhase;
    playerStates: Record<string, OneNightPlayerState>;
    ruleSettings: OneNightRuleSettings;
    votes: Record<string, string>;
    winner: 'villager' | 'werewolf' | null;
}

export const ROLE_DATA: Record<OneNightRole, { name: string, description: string, team: 'villager' | 'werewolf' }> = {
    villager: { name: "市民", description: "特別な能力はありません。", team: "villager" },
    werewolf: { name: "人狼", description: "他の人狼を確認できます。", team: "werewolf" },
    seer: { name: "占い師", description: "誰か1人の役職か、場にある2つの役職を見られます。", team: "villager" },
    robber: { name: "怪盗", description: "誰か1人と役職を交換できます。", team: "villager" }
};

export const DEFAULT_ONE_NIGHT_STATE: OneNightGameState = {
    phase: 'rule_setting',
    playerStates: {},
    ruleSettings: {
        roles: ['villager', 'werewolf', 'seer', 'robber'],
        timeLimit: 300
    },
    votes: {},
    winner: null
};