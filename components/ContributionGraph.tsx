import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Entry } from '../services/EntryService';

interface Props {
    entries: Entry[];
}

export default function ContributionGraph({ entries }: Props) {
    const router = useRouter();
    const today = new Date();
    const days: { date: Date; count: number; duration: number }[] = [];

    // Generate last 14 weeks (approx 98 days)
    for (let i = 0; i < 14 * 7; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - ((14 * 7) - 1 - i));
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

    const getColor = (duration: number) => {
        if (duration === 0) return 'bg-gray-200';
        if (duration < 60) return 'bg-green-200';
        if (duration < 300) return 'bg-green-400';
        return 'bg-green-600';
    };

    return (
        <View className="flex-row flex-wrap gap-1 p-2 justify-center">
            {days.map((day, index) => (
                <TouchableOpacity
                    key={index}
                    className={`w-4 h-4 rounded-sm ${getColor(day.duration)}`}
                    onPress={() => {
                        router.push({
                            pathname: "/details",
                            params: { date: day.date.toISOString() }
                        });
                    }}
                />
            ))}
        </View>
    );
}
