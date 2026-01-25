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

    const days: { date: Date; count: number; duration: number }[] = [];

    // Generate approx last 5 weeks instead of 14 for a cleaner, focused view
    // or maybe simple 7x5 grid (35 days)
    // Generate last 3 weeks (21 days) for a compact header view
    const weeksToShow = 4;
    const totalDays = weeksToShow * 7;

    // Align to start of week? Or just last 35 days?
    // Let's align so the last cell is today or close to it, but filling rows.
    for (let i = 0; i < totalDays; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - (totalDays - 1 - i));
        days.push({ date: d, count: 0, duration: 0 });
    }

    // Populate data
    entries.forEach(entry => {
        const entryDate = new Date(entry.date);
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
        if (count === 0) return 1; // Base opacity for empty
        if (count === 2) return 0.5;
        if (count === 4) return 0.7;
        if (count === 10) return 0.9;
        return 1.0;
    };

    return (
        <View className="w-full">
            <View className="mb-2 px-2">
                <Text className="text-xl font-bold text-slate-800 tracking-tight">{currentMonth}</Text>
                <Text className="text-slate-400 font-medium text-xs mt-1">
                    今月: {currentMonthCount} 件
                </Text>
            </View>

            <View className="flex-row flex-wrap gap-2 justify-between p-2">
                {days.map((day, index) => {
                    const hasData = day.count > 0;
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
                                width: (Dimensions.get('window').width - 80) / 9, // Smaller blocks (divide by 9 instead of 7)
                                aspectRatio: 1,
                            }}
                        >
                            <View
                                className={`w-full h-full rounded-md ${hasData ? 'shadow-sm' : ''}`}
                                style={{
                                    backgroundColor: hasData ? '#3B82F6' : 'rgba(255, 255, 255, 0.4)', // Transparent white for empty
                                    opacity: hasData ? getOpacity(day.count) : 1, // Full opacity for the white bg itself
                                    borderWidth: hasData ? 0 : 1,
                                    borderColor: hasData ? 'transparent' : 'rgba(255, 255, 255, 0.2)', // Subtle border for empty
                                }}
                            />
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}
