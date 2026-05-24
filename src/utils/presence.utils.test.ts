import { getPresenceStatus } from './presence.utils';

describe('getPresenceStatus', () => {
  const now = new Date('2026-03-24T10:00:00.000Z').getTime();

  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(now);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns unknown for missing values', () => {
    expect(getPresenceStatus()).toEqual({
      label: 'Еще не заходил(а) после обновления',
      tone: 'unknown',
    });
  });

  it('returns online for recent activity under 2 minutes', () => {
    expect(getPresenceStatus('2026-03-24T09:59:10.000Z')).toEqual({
      label: 'Онлайн',
      tone: 'online',
    });
  });

  it('returns recent for activity under 10 minutes', () => {
    expect(getPresenceStatus('2026-03-24T09:54:30.000Z')).toEqual({
      label: 'В сети недавно',
      tone: 'recent',
    });
  });

  it('returns minute-based offline status within an hour', () => {
    expect(getPresenceStatus('2026-03-24T09:15:00.000Z')).toEqual({
      label: 'Был(а) в сети 45 мин назад',
      tone: 'offline',
    });
  });

  it('returns hour-based offline status within a day', () => {
    expect(getPresenceStatus('2026-03-24T05:00:00.000Z')).toEqual({
      label: 'Был(а) в сети 5 ч назад',
      tone: 'offline',
    });
  });
});
