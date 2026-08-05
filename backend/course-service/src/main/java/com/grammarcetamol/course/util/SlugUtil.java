package com.grammarcetamol.course.util;

public final class SlugUtil {

    private SlugUtil() {
    }

    public static String slugify(String input) {
        return input.toLowerCase().trim()
            .replaceAll("[^a-z0-9]+", "-")
            .replaceAll("(^-+|-+$)", "");
    }
}
