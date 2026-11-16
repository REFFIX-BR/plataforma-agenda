import { useEffect, useRef } from "react"
import { Animated, Easing, Image, Platform, StyleSheet, Text, View } from "react-native"
import { useLayout } from "./layout"

const appIcon = require("../assets/icon.png")

export function SplashBoot() {
  const layout = useLayout()
  const iconOpacity = useRef(new Animated.Value(0)).current
  const iconScale = useRef(new Animated.Value(0.86)).current
  const iconFloat = useRef(new Animated.Value(0)).current
  const titleOpacity = useRef(new Animated.Value(0)).current
  const titleRise = useRef(new Animated.Value(16)).current
  const lineOpacity = useRef(new Animated.Value(0)).current
  const lineRise = useRef(new Animated.Value(12)).current
  const sheen = useRef(new Animated.Value(0)).current
  const bar = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(iconOpacity, {
        toValue: 1,
        duration: 560,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(iconScale, {
        toValue: 1,
        friction: 6,
        tension: 58,
        useNativeDriver: true,
      }),
    ]).start()

    Animated.parallel([
      Animated.timing(titleOpacity, {
        toValue: 1,
        duration: 480,
        delay: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(titleRise, {
        toValue: 0,
        duration: 480,
        delay: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start()

    Animated.parallel([
      Animated.timing(lineOpacity, {
        toValue: 1,
        duration: 460,
        delay: 340,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(lineRise, {
        toValue: 0,
        duration: 460,
        delay: 340,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start()

    Animated.loop(
      Animated.sequence([
        Animated.timing(iconFloat, {
          toValue: -6,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(iconFloat, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    ).start()

    Animated.loop(
      Animated.sequence([
        Animated.timing(sheen, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(sheen, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ).start()

    Animated.loop(
      Animated.sequence([
        Animated.timing(bar, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.timing(bar, {
          toValue: 0,
          duration: 0,
          useNativeDriver: false,
        }),
      ]),
    ).start()
  }, [bar, iconFloat, iconOpacity, iconScale, lineOpacity, lineRise, sheen, titleOpacity, titleRise])

  const barWidth = bar.interpolate({
    inputRange: [0, 1],
    outputRange: ["16%", "100%"],
  })

  const sheenOpacity = sheen.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.18, 0.42, 0.18],
  })

  return (
    <View style={[styles.screen, { paddingTop: layout.top, paddingBottom: layout.bottom + 36 }]}>
      <View style={styles.glowTop} pointerEvents="none" />
      <View style={styles.glowBottom} pointerEvents="none" />
      <Animated.View style={[styles.sheen, { opacity: sheenOpacity }]} pointerEvents="none" />

      <View style={styles.stage}>
        <Animated.View
          style={{
            opacity: iconOpacity,
            transform: [{ translateY: iconFloat }, { scale: iconScale }],
          }}
        >
          <View style={styles.iconWrap}>
            <Image source={appIcon} style={styles.icon} resizeMode="contain" accessibilityLabel="+Agenda" />
          </View>
        </Animated.View>

        <Animated.View style={{ opacity: titleOpacity, transform: [{ translateY: titleRise }], alignItems: "center" }}>
          <Text style={styles.brand}>+Agenda</Text>
          <View style={styles.rule} />
        </Animated.View>

        <Animated.View style={{ opacity: lineOpacity, transform: [{ translateY: lineRise }] }}>
          <Text style={styles.tagline}>Hora marcada, sem complicação</Text>
        </Animated.View>
      </View>

      <View style={styles.footer}>
        <View style={styles.track}>
          <Animated.View style={[styles.fill, { width: barWidth }]} />
        </View>
        <Text style={styles.loading}>Preparando sua agenda</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#804350",
    overflow: "hidden",
  },
  glowTop: {
    position: "absolute",
    top: -120,
    left: -80,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "rgba(246, 239, 232, 0.14)",
  },
  glowBottom: {
    position: "absolute",
    right: -100,
    bottom: -140,
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: "rgba(40, 18, 24, 0.28)",
  },
  sheen: {
    position: "absolute",
    top: "22%",
    alignSelf: "center",
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "rgba(246, 239, 232, 0.16)",
  },
  stage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 18,
  },
  iconWrap: {
    shadowColor: "#2a1218",
    shadowOpacity: 0.35,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 16 },
    elevation: 12,
  },
  icon: {
    width: 128,
    height: 128,
    borderRadius: 32,
  },
  brand: {
    color: "#f6efe8",
    fontSize: 42,
    lineHeight: 48,
    fontWeight: "700",
    letterSpacing: -0.8,
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    textAlign: "center",
  },
  rule: {
    marginTop: 12,
    width: 42,
    height: 2,
    borderRadius: 999,
    backgroundColor: "rgba(246, 239, 232, 0.45)",
  },
  tagline: {
    color: "rgba(246, 239, 232, 0.78)",
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
    letterSpacing: 0.2,
  },
  footer: {
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 48,
  },
  track: {
    width: 118,
    height: 3,
    borderRadius: 999,
    backgroundColor: "rgba(246, 239, 232, 0.18)",
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#f6efe8",
  },
  loading: {
    color: "rgba(246, 239, 232, 0.62)",
    fontSize: 13,
    letterSpacing: 0.3,
  },
})
