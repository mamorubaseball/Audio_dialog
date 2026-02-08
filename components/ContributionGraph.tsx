import { View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Entry } from '../services/EntryService';
import { LinearGradient } from 'expo-linear-gradient';

interface Props {
    entries: Entry[];
}

export default function ContributionGraph({ entries }: Props) {
    const router = useRouter();
    const today = new Date();
    const currentMonth = today.toLocaleString('ja-JP', { month: 'long', year: 'numeric' });

    // Filter entries for current month count
    const currentMonthCount = entries.filter(e => {
        const d = new Date(e.date);
        return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
    }).length;

    // Generate 4 weeks (28 days) aligned to Sunday
    // Strategy: Find the Sunday of the *current* week, then go back 3 weeks.
    // This gives us 4 rows: [3 weeks ago], [2 weeks ago], [1 week ago], [This week]

    // 1. Find Sunday of this week
    const dayOfWeek = today.getDay(); // 0 (Sun) - 6 (Sat)
    const thisSunday = new Date(today);
    thisSunday.setDate(today.getDate() - dayOfWeek);

    // 2. Go back 3 weeks (21 days) to get the start date
    const startDate = new Date(thisSunday);
    startDate.setDate(thisSunday.getDate() - 21);

    const totalDays = 28; // 7 cols * 4 rows

    const days: { date: Date; count: number; duration: number }[] = [];

    for (let i = 0; i < totalDays; i++) {
        const d = new Date(startDate);
        d.setDate(startDate.getDate() + i);
        days.push({
            date: d,
            count: 0,
            duration: 0
        });
    }

    // Populate data
    entries.forEach(entry => {
        const entryDate = new Date(entry.date);
        // Normalize to YYYY-MM-DD comparison to avoid time issues
        const day = days.find(d =>
            d.date.getDate() === entryDate.getDate() &&
            d.date.getMonth() === entryDate.getMonth() &&
            d.date.getFullYear() === entryDate.getFullYear()
        );
        if (day) {
            day.count += 1;
            day.duration += entry.duration;
        }
    });

    const getOpacity = (count: number) => {
        if (count === 0) return 1;
        if (count === 2) return 0.5;
        if (count === 4) return 0.7;
        if (count >= 5) return 0.9;
        return 1.0;
    };

    const weekDays = ['日', '月', '火', '水', '木', '金', '土'];
    const screenWidth = Dimensions.get('window').width;
    // Increase padding to make the whole calendar smaller (32px * 2 side padding + 16px * 2 outer margin)
    // Total horizontal space consumed by margins/padding = 64 + 32 = 96
    const containerPadding = 32;
    const gap = 4;
    // Calculate precise width: (Screen - ContainerPadding * 2 - (Gap * 6)) / 7
    // Use Math.floor to ensure it fits
    const itemSize = Math.floor((screenWidth - (containerPadding * 2) - (gap * 6)) / 7);

    return (
        <View className="w-full px-4">
            <View className="mb-2 px-2">
                <Text className="text-xl font-bold text-slate-800 tracking-tight">{currentMonth}</Text>
                <Text className="text-slate-400 font-medium text-xs mt-1">
                    直近4週間
                </Text>
            </View>

            {/* Week Headers */}
            <View className="flex-row mb-1 justify-center" style={{ gap: gap }}>
                {weekDays.map((day, index) => (
                    <View key={index} style={{ width: itemSize, alignItems: 'center' }}>
                        <Text className={`text-[10px] font-medium ${index === 0 ? 'text-red-400' : (index === 6 ? 'text-blue-400' : 'text-slate-400')}`}>
                            {day}
                        </Text>
                    </View>
                ))}
            </View>

            {/* Calendar Grid */}
            <View className="flex-row flex-wrap justify-center" style={{ gap: gap, width: (itemSize * 7) + (gap * 6) }}>
                {days.map((day, index) => {
                    const hasData = day.count > 0;
                    const isToday = day.date.getDate() === today.getDate() && day.date.getMonth() === today.getMonth();

                    return (
                        <TouchableOpacity
                            key={index}
                            activeOpacity={0.7}
                            onPress={() => {
                                router.push({
                                    pathname: "/details",
                                    params: { date: day.date.toISOString() }
                                });
                            }}
                            style={{
                                width: itemSize,
                                height: itemSize, // Use height instead of aspectRatio to be explicit
                            }}
                        >
                            <View
                                className={`w-full h-full rounded-md ${hasData ? 'shadow-sm' : ''} ${isToday ? 'border-2 border-slate-300' : ''}`}
                                style={{
                                    backgroundColor: hasData ? '#3B82F6' : 'rgba(255, 255, 255, 0.5)',
                                    opacity: hasData ? getOpacity(day.count) : 1,
                                    borderWidth: isToday ? 2 : (hasData ? 0 : 0),
                                }}
                            />
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}
