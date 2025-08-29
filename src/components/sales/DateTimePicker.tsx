// src/components/DateTimePicker.tsx
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

interface CustomDateTimePickerProps {
  visible: boolean;
  mode: 'date' | 'time';
  value: Date;
  onClose: () => void;
  onConfirm: (date: Date) => void;
  minimumDate?: Date;
}

export default function CustomDateTimePicker({
  visible,
  mode,
  value,
  onClose,
  onConfirm,
  minimumDate,
}: CustomDateTimePickerProps) {
  const [selectedDate, setSelectedDate] = useState(value);
  const [selectedMonth, setSelectedMonth] = useState(value.getMonth());
  const [selectedYear, setSelectedYear] = useState(value.getFullYear());
  const [selectedHour, setSelectedHour] = useState(value.getHours() % 12 || 12);
  const [selectedMinute, setSelectedMinute] = useState(value.getMinutes());
  const [selectedPeriod, setSelectedPeriod] = useState<'AM' | 'PM'>(
    value.getHours() >= 12 ? 'PM' : 'AM'
  );

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear + i);

  const getDaysInMonth = (month: number, year: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const isDateDisabled = (day: number) => {
    if (!minimumDate) return false;
    const checkDate = new Date(selectedYear, selectedMonth, day);
    return checkDate < minimumDate;
  };

  const handleDateSelect = (day: number) => {
    if (!isDateDisabled(day)) {
      const newDate = new Date(selectedYear, selectedMonth, day);
      setSelectedDate(newDate);
    }
  };

  const handleConfirm = () => {
    if (mode === 'date') {
      const finalDate = new Date(selectedYear, selectedMonth, selectedDate.getDate());
      onConfirm(finalDate);
    } else {
      const hours = selectedPeriod === 'PM' && selectedHour !== 12 
        ? selectedHour + 12 
        : selectedPeriod === 'AM' && selectedHour === 12 
        ? 0 
        : selectedHour;
      const finalDate = new Date(value);
      finalDate.setHours(hours, selectedMinute);
      onConfirm(finalDate);
    }
    onClose();
  };

  const renderDatePicker = () => {
    const daysInMonth = getDaysInMonth(selectedMonth, selectedYear);
    const firstDayOfMonth = new Date(selectedYear, selectedMonth, 1).getDay();
    const days = [];

    // Empty cells for days before month starts
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(<View key={`empty-${i}`} style={styles.dayCell} />);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const isDisabled = isDateDisabled(day);
      const isSelected = selectedDate.getDate() === day && 
                        selectedDate.getMonth() === selectedMonth &&
                        selectedDate.getFullYear() === selectedYear;

      days.push(
        <TouchableOpacity
          key={day}
          style={[
            styles.dayCell,
            isSelected && styles.selectedDay,
            isDisabled && styles.disabledDay,
          ]}
          onPress={() => handleDateSelect(day)}
          disabled={isDisabled}
        >
          <Text style={[
            styles.dayText,
            isSelected && styles.selectedDayText,
            isDisabled && styles.disabledDayText,
          ]}>
            {day}
          </Text>
        </TouchableOpacity>
      );
    }

    return (
      <View>
        {/* Month and Year Selector */}
        <View style={styles.monthYearContainer}>
          <TouchableOpacity
            style={styles.monthYearButton}
            onPress={() => {
              const newMonth = selectedMonth - 1;
              if (newMonth < 0) {
                setSelectedMonth(11);
                setSelectedYear(selectedYear - 1);
              } else {
                setSelectedMonth(newMonth);
              }
            }}
          >
            <Ionicons name="chevron-back" size={24} color="#E74C3C" />
          </TouchableOpacity>

          <View style={styles.monthYearDisplay}>
            <Text style={styles.monthYearText}>
              {months[selectedMonth]} {selectedYear}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.monthYearButton}
            onPress={() => {
              const newMonth = selectedMonth + 1;
              if (newMonth > 11) {
                setSelectedMonth(0);
                setSelectedYear(selectedYear + 1);
              } else {
                setSelectedMonth(newMonth);
              }
            }}
          >
            <Ionicons name="chevron-forward" size={24} color="#E74C3C" />
          </TouchableOpacity>
        </View>

        {/* Days of Week Header */}
        <View style={styles.weekDaysContainer}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
            <View key={index} style={styles.weekDayCell}>
              <Text style={styles.weekDayText}>{day}</Text>
            </View>
          ))}
        </View>

        {/* Calendar Grid */}
        <View style={styles.daysContainer}>
          {days}
        </View>
      </View>
    );
  };

  const renderTimePicker = () => {
    const hours = Array.from({ length: 12 }, (_, i) => i + 1);
    const minutes = Array.from({ length: 60 }, (_, i) => i);

    return (
      <View style={styles.timePickerContainer}>
        <View style={styles.timeSection}>
          <Text style={styles.timeSectionLabel}>Hour</Text>
          <ScrollView style={styles.timeScrollView} showsVerticalScrollIndicator={false}>
            {hours.map(hour => (
              <TouchableOpacity
                key={hour}
                style={[
                  styles.timeItem,
                  selectedHour === hour && styles.selectedTimeItem,
                ]}
                onPress={() => setSelectedHour(hour)}
              >
                <Text style={[
                  styles.timeItemText,
                  selectedHour === hour && styles.selectedTimeItemText,
                ]}>
                  {hour.toString().padStart(2, '0')}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.timeSection}>
          <Text style={styles.timeSectionLabel}>Minute</Text>
          <ScrollView style={styles.timeScrollView} showsVerticalScrollIndicator={false}>
            {minutes.map(minute => (
              <TouchableOpacity
                key={minute}
                style={[
                  styles.timeItem,
                  selectedMinute === minute && styles.selectedTimeItem,
                ]}
                onPress={() => setSelectedMinute(minute)}
              >
                <Text style={[
                  styles.timeItemText,
                  selectedMinute === minute && styles.selectedTimeItemText,
                ]}>
                  {minute.toString().padStart(2, '0')}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.timeSection}>
          <Text style={styles.timeSectionLabel}>Period</Text>
          <View style={styles.periodContainer}>
            <TouchableOpacity
              style={[
                styles.periodButton,
                selectedPeriod === 'AM' && styles.selectedPeriodButton,
              ]}
              onPress={() => setSelectedPeriod('AM')}
            >
              <Text style={[
                styles.periodButtonText,
                selectedPeriod === 'AM' && styles.selectedPeriodButtonText,
              ]}>
                AM
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.periodButton,
                selectedPeriod === 'PM' && styles.selectedPeriodButton,
              ]}
              onPress={() => setSelectedPeriod('PM')}
            >
              <Text style={[
                styles.periodButtonText,
                selectedPeriod === 'PM' && styles.selectedPeriodButtonText,
              ]}>
                PM
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={styles.modalBackdrop} onPress={onClose} />
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {mode === 'date' ? 'Select Date' : 'Select Time'}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <View style={styles.pickerContent}>
            {mode === 'date' ? renderDatePicker() : renderTimePicker()}
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
              <Text style={styles.confirmButtonText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  pickerContent: {
    padding: 20,
  },
  monthYearContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  monthYearButton: {
    padding: 8,
  },
  monthYearDisplay: {
    flex: 1,
    alignItems: 'center',
  },
  monthYearText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  weekDaysContainer: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  weekDayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  weekDayText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  daysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  dayText: {
    fontSize: 16,
    color: '#333',
  },
  selectedDay: {
    backgroundColor: '#E74C3C',
    borderRadius: 20,
  },
  selectedDayText: {
    color: '#FFF',
    fontWeight: '600',
  },
  disabledDay: {
    opacity: 0.3,
  },
  disabledDayText: {
    color: '#999',
  },
  timePickerContainer: {
    flexDirection: 'row',
    height: 250,
  },
  timeSection: {
    flex: 1,
    marginHorizontal: 5,
  },
  timeSectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
    marginBottom: 10,
  },
  timeScrollView: {
    flex: 1,
  },
  timeItem: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  timeItemText: {
    fontSize: 16,
    color: '#333',
  },
  selectedTimeItem: {
    backgroundColor: '#E74C3C',
    borderRadius: 8,
  },
  selectedTimeItemText: {
    color: '#FFF',
    fontWeight: '600',
  },
  periodContainer: {
    paddingTop: 20,
  },
  periodButton: {
    paddingVertical: 15,
    marginBottom: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignItems: 'center',
  },
  selectedPeriodButton: {
    backgroundColor: '#E74C3C',
    borderColor: '#E74C3C',
  },
  periodButtonText: {
    fontSize: 16,
    color: '#333',
  },
  selectedPeriodButtonText: {
    color: '#FFF',
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#E74C3C',
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 16,
    color: '#FFF',
    fontWeight: '600',
  },
});