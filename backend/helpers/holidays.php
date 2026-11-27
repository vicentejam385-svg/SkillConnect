<?php
// backend/helpers/holidays.php
// Philippine non-working days used to block job order start dates (together with Saturdays and Sundays).
// 2026 and 2027 follow the official proclamations (Proc. 1006 s. 2025 for 2026; the 2027 list).
// Other years are worked out from the usual rules. Eid'l Fitr / Eid'l Adha (and any extra holiday)
// are proclaimed later each year: add them to PH_EXTRA_HOLIDAYS when they are announced.

const PH_EXTRA_HOLIDAYS = [
    // 'YYYY-MM-DD' => 'Name',   e.g. '2026-03-20' => "Eid'l Fitr",
];

const PH_OFFICIAL_HOLIDAYS = [
    2026 => [
        '2026-01-01' => "New Year's Day",      '2026-02-17' => 'Chinese New Year',
        '2026-04-02' => 'Maundy Thursday',     '2026-04-03' => 'Good Friday',
        '2026-04-04' => 'Black Saturday',      '2026-04-09' => 'Araw ng Kagitingan',
        '2026-05-01' => 'Labor Day',           '2026-06-12' => 'Independence Day',
        '2026-08-21' => 'Ninoy Aquino Day',    '2026-08-31' => 'National Heroes Day',
        '2026-11-01' => "All Saints' Day",     '2026-11-02' => "All Souls' Day",
        '2026-11-30' => 'Bonifacio Day',       '2026-12-08' => 'Immaculate Conception',
        '2026-12-24' => 'Christmas Eve',       '2026-12-25' => 'Christmas Day',
        '2026-12-30' => 'Rizal Day',           '2026-12-31' => 'Last Day of the Year',
    ],
    2027 => [
        '2027-01-01' => "New Year's Day",      '2027-02-06' => 'Chinese New Year',
        '2027-03-25' => 'Maundy Thursday',     '2027-03-26' => 'Good Friday',
        '2027-03-27' => 'Black Saturday',      '2027-04-09' => 'Araw ng Kagitingan',
        '2027-05-01' => 'Labor Day',           '2027-06-12' => 'Independence Day',
        '2027-08-21' => 'Ninoy Aquino Day',    '2027-08-30' => 'National Heroes Day',
        '2027-11-01' => "All Saints' Day",     '2027-11-02' => "All Souls' Day",
        '2027-11-30' => 'Bonifacio Day',       '2027-12-08' => 'Immaculate Conception',
        '2027-12-24' => 'Christmas Eve',       '2027-12-25' => 'Christmas Day',
        '2027-12-30' => 'Rizal Day',           '2027-12-31' => 'Last Day of the Year',
    ],
];

/** ['Y-m-d' => name] for one year. */
function phHolidays(int $year): array
{
    if (isset(PH_OFFICIAL_HOLIDAYS[$year])) {
        $list = PH_OFFICIAL_HOLIDAYS[$year];
    } else {
        $list = [];
        foreach ([
            '01-01' => "New Year's Day", '04-09' => 'Araw ng Kagitingan', '05-01' => 'Labor Day',
            '06-12' => 'Independence Day', '08-21' => 'Ninoy Aquino Day', '11-01' => "All Saints' Day",
            '11-02' => "All Souls' Day", '11-30' => 'Bonifacio Day', '12-08' => 'Immaculate Conception',
            '12-24' => 'Christmas Eve', '12-25' => 'Christmas Day', '12-30' => 'Rizal Day', '12-31' => 'Last Day of the Year',
        ] as $md => $name) $list["$year-$md"] = $name;
        // Holy Week (from Easter Sunday)
        $easter = (new DateTime("$year-03-21"))->modify('+' . easter_days_safe($year) . ' days');
        $list[(clone $easter)->modify('-3 days')->format('Y-m-d')] = 'Maundy Thursday';
        $list[(clone $easter)->modify('-2 days')->format('Y-m-d')] = 'Good Friday';
        $list[(clone $easter)->modify('-1 day')->format('Y-m-d')]  = 'Black Saturday';
        // National Heroes Day: last Monday of August
        $list[(new DateTime("last monday of august $year"))->format('Y-m-d')] = 'National Heroes Day';
    }
    foreach (PH_EXTRA_HOLIDAYS as $d => $name) if (str_starts_with($d, (string)$year)) $list[$d] = $name;
    ksort($list);
    return $list;
}

/** Days after March 21 to Easter Sunday (works without the calendar extension). */
function easter_days_safe(int $y): int
{
    if (function_exists('easter_days')) return easter_days($y);
    $a = $y % 19; $b = intdiv($y, 100); $c = $y % 100; $d = intdiv($b, 4); $e = $b % 4;
    $f = intdiv($b + 8, 25); $g = intdiv($b - $f + 1, 3); $h = (19 * $a + $b - $d - $g + 15) % 30;
    $i = intdiv($c, 4); $k = $c % 4; $l = (32 + 2 * $e + 2 * $i - $h - $k) % 7;
    $m = intdiv($a + 11 * $h + 22 * $l, 451);
    $month = intdiv($h + $l - 7 * $m + 114, 31); $day = (($h + $l - 7 * $m + 114) % 31) + 1;
    return (int)((new DateTime("$y-03-21"))->diff(new DateTime(sprintf('%04d-%02d-%02d', $y, $month, $day)))->days);
}

/** Why a date can't be a start date (Saturday, Sunday or a holiday), or null when it is a working day. */
function phNonWorkingReason(string $date): ?string
{
    $d = DateTime::createFromFormat('Y-m-d', $date);
    if (!$d) return 'Invalid date.';
    $dow = (int)$d->format('N');
    if ($dow === 6) return 'Saturday';
    if ($dow === 7) return 'Sunday';
    $h = phHolidays((int)$d->format('Y'));
    return $h[$date] ?? null;
}