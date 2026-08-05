package com.grammarcetamol.course.service;

import com.grammarcetamol.shared.config.CurrentUser;
import com.grammarcetamol.course.dto.CreateCategoryRequest;
import com.grammarcetamol.course.entity.Category;
import com.grammarcetamol.shared.exception.ForbiddenException;
import com.grammarcetamol.course.repository.CategoryRepository;
import com.grammarcetamol.course.util.SlugUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class CategoryService {

    private final CategoryRepository categoryRepository;

    public List<Category> listAll() {
        return categoryRepository.findAllByOrderBySortOrderAsc();
    }

    @Transactional
    public Category create(CreateCategoryRequest request, CurrentUser currentUser) {
        if (!currentUser.isAdminOrModerator()) {
            throw new ForbiddenException("Only super admins or moderators can manage categories");
        }

        String slug = (request.getSlug() == null || request.getSlug().isBlank())
            ? SlugUtil.slugify(request.getName())
            : SlugUtil.slugify(request.getSlug());

        if (categoryRepository.existsBySlug(slug)) {
            throw new IllegalArgumentException("A category with slug '" + slug + "' already exists");
        }

        Category category = new Category();
        category.setName(request.getName());
        category.setSlug(slug);
        category.setDescription(request.getDescription());
        category.setIconUrl(request.getIconUrl());
        category.setParentId(request.getParentId());
        category.setSortOrder(request.getSortOrder());
        return categoryRepository.save(category);
    }
}
