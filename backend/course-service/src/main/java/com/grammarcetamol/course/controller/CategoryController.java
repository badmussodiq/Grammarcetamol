package com.grammarcetamol.course.controller;

import com.grammarcetamol.course.config.CurrentUser;
import com.grammarcetamol.course.dto.ApiResponse;
import com.grammarcetamol.course.dto.CreateCategoryRequest;
import com.grammarcetamol.course.entity.Category;
import com.grammarcetamol.course.service.CategoryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/categories")
@RequiredArgsConstructor
public class CategoryController {

    private final CategoryService categoryService;

    @GetMapping
    public ApiResponse<List<Category>> list() {
        return ApiResponse.success(categoryService.listAll());
    }

    @PostMapping
    public ResponseEntity<ApiResponse<Category>> create(@Valid @RequestBody CreateCategoryRequest request,
                                                          CurrentUser currentUser) {
        Category created = categoryService.create(request, currentUser);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(created));
    }
}
