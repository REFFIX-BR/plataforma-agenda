import { useEffect, useRef, type ReactNode } from "react"
import { Animated, Easing, Pressable, View, type PressableProps, type StyleProp, type ViewStyle } from "react-native"

export function ScreenEnter(props: { id: string; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const opacity = useRef(new Animated.Value(0)).current
  const rise = useRef(new Animated.Value(16)).current

  useEffect(() => {
    opacity.setValue(0)
    rise.setValue(16)
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(rise, { toValue: 0, friction: 8, tension: 70, useNativeDriver: true }),
    ]).start()
  }, [props.id, opacity, rise])

  return <Animated.View style={[{ flex: 1, opacity, transform: [{ translateY: rise }] }, props.style]}>{props.children}</Animated.View>
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

export function SoftPress(props: PressableProps & { children: ReactNode }) {
  const scale = useRef(new Animated.Value(1)).current
  const { children, onPressIn, onPressOut, style, ...rest } = props
  return (
    <AnimatedPressable
      {...rest}
      style={[style as ViewStyle, { transform: [{ scale }] }]}
      onPressIn={(event) => {
        Animated.spring(scale, { toValue: 0.97, friction: 6, tension: 180, useNativeDriver: true }).start()
        onPressIn?.(event)
      }}
      onPressOut={(event) => {
        Animated.spring(scale, { toValue: 1, friction: 5, tension: 160, useNativeDriver: true }).start()
        onPressOut?.(event)
      }}
    >
      {children}
    </AnimatedPressable>
  )
}

export function Stagger(props: { index: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const opacity = useRef(new Animated.Value(0)).current
  const rise = useRef(new Animated.Value(14)).current
  useEffect(() => {
    const delay = Math.min(props.index, 8) * 55
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 320, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(rise, { toValue: 0, friction: 8, tension: 70, delay, useNativeDriver: true }),
    ]).start()
  }, [opacity, rise, props.index])
  return <Animated.View style={[props.style, { opacity, transform: [{ translateY: rise }] }]}>{props.children}</Animated.View>
}

export function Pop(props: { active: boolean; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const scale = useRef(new Animated.Value(props.active ? 0.82 : 1)).current
  useEffect(() => {
    Animated.spring(scale, {
      toValue: 1,
      friction: props.active ? 5 : 8,
      tension: props.active ? 180 : 80,
      useNativeDriver: true,
    }).start()
  }, [props.active, scale])
  return <Animated.View style={[props.style, { transform: [{ scale }] }]}>{props.children}</Animated.View>
}

export function Unfold(props: { children: ReactNode }) {
  const opacity = useRef(new Animated.Value(0)).current
  const rise = useRef(new Animated.Value(-8)).current
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(rise, { toValue: 0, friction: 7, tension: 120, useNativeDriver: true }),
    ]).start()
  }, [opacity, rise])
  return <Animated.View style={{ opacity, transform: [{ translateY: rise }] }}>{props.children}</Animated.View>
}

export function GrowBar(props: { percent: number; color: string; track: string }) {
  const value = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(value, {
      toValue: Math.max(0, Math.min(100, props.percent)),
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start()
  }, [props.percent, value])
  const width = value.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] })
  return (
    <View style={{ height: 8, backgroundColor: props.track, borderRadius: 99, overflow: "hidden" }}>
      <Animated.View style={{ height: 8, width, backgroundColor: props.color, borderRadius: 99 }} />
    </View>
  )
}

export const cardShadow: ViewStyle = {
  shadowColor: "#2a211c",
  shadowOpacity: 0.08,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 6 },
  elevation: 3,
}
